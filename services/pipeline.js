// ---------------------------------------------------------------------------
// The "critical thinking" core.
//
// Runs on every new case and whenever a narrative is edited:
//   1. Extract identifiers (regex)               -> services/extract.js
//   2. Rule-based exact identifier matches        -> CaseLink shared_identifier
//   3. Generate embedding                         -> services/ai.js
//   4. Semantic similarity vs every other case    -> CaseLink semantic_similarity
//   5. AI hypothesis for every candidate pair     -> CaseLink ai_hypothesis
//
// Nothing is auto-merged or auto-concluded. Every link is officerReviewed:false
// until a human confirms or dismisses it.
// ---------------------------------------------------------------------------
import Case from '../models/Case.js';
import CaseEmbedding from '../models/CaseEmbedding.js';
import CaseLink, { orderPair } from '../models/CaseLink.js';
import { extractIdentifiers, sharedIdentifiers, identifiersToText } from './extract.js';
import { topSimilar } from './similarity.js';
import { embedText, compareCases, defaultSimilarityThreshold } from './ai.js';

// Evaluated per run: defaultSimilarityThreshold() depends on the ACTIVE backend,
// which can flip from openai -> mock mid-run if an OpenAI call fails.
function activeThreshold() {
  return process.env.SIMILARITY_THRESHOLD
    ? parseFloat(process.env.SIMILARITY_THRESHOLD)
    : defaultSimilarityThreshold();
}
const TOP_K = parseInt(process.env.SIMILARITY_TOP_K || '5', 10);

async function upsertLink(idA, idB, linkType, fields) {
  const [caseA, caseB] = orderPair(idA, idB);
  return CaseLink.findOneAndUpdate(
    { caseA, caseB, linkType },
    {
      $set: { ...fields },
      $setOnInsert: { caseA, caseB, linkType, officerReviewed: false, officerVerdict: 'pending' },
    },
    { upsert: true, new: true }
  );
}

export async function runPipeline(caseId, { log = () => {} } = {}) {
  const kase = await Case.findById(caseId);
  if (!kase) return;

  await Case.updateOne({ _id: caseId }, { $set: { 'analysis.state': 'running' } });

  try {
    // --- Step 1: extract identifiers -------------------------------------
    const identifiers = extractIdentifiers(kase.narrative);
    kase.extractedIdentifiers = identifiers;
    await kase.save();
    log(`[pipeline] ${kase.caseNumber}: extracted identifiers`);

    const others = await Case.find({ _id: { $ne: caseId } }).lean();

    // --- Step 2: rule-based exact identifier matches --------------------
    const identifierCandidates = new Map(); // otherId -> matchedOn[]
    for (const other of others) {
      const matched = sharedIdentifiers(identifiers, other.extractedIdentifiers || {});
      if (matched.length) {
        identifierCandidates.set(String(other._id), matched);
        await upsertLink(caseId, other._id, 'shared_identifier', {
          matchedOn: matched,
          aiConfidence: 'high',
          aiConnected: true,
          aiRationale: `Exact shared identifier(s): ${matched.join('; ')}. This is a rule-based match, not an AI inference.`,
          suggestedNextStep:
            'Verify the shared identifier belongs to the same entity in both cases (KYC / call records) and consider clubbing the FIRs.',
        });
      }
    }
    log(`[pipeline] ${kase.caseNumber}: ${identifierCandidates.size} shared-identifier match(es)`);

    // --- Step 3: generate embedding -----------------------------------
    const embedInput = `${kase.title}\n${kase.narrative}\n${identifiersToText(identifiers)}`;
    const { vector, model } = await embedText(embedInput);
    await CaseEmbedding.findOneAndUpdate(
      { caseId },
      { $set: { vector, model, generatedAt: new Date() } },
      { upsert: true }
    );
    log(`[pipeline] ${kase.caseNumber}: embedding (${model}, dim ${vector.length})`);

    // --- Step 4: semantic similarity ---------------------------------
    const threshold = activeThreshold();
    const otherEmbeddings = await CaseEmbedding.find({ caseId: { $ne: caseId } }).lean();
    const semantic = topSimilar(vector, otherEmbeddings, {
      threshold,
      topK: TOP_K,
    });
    for (const { caseId: otherId, score } of semantic) {
      // Confidence relative to the active threshold so it reads sensibly on
      // both the OpenAI and mock embedding scales.
      const margin = score - threshold;
      await upsertLink(caseId, otherId, 'semantic_similarity', {
        similarityScore: score,
        aiConnected: true,
        aiConfidence: margin >= 0.15 ? 'high' : margin >= 0.06 ? 'medium' : 'low',
        aiRationale: `Narratives are semantically similar (cosine ${score.toFixed(3)}, threshold ${threshold.toFixed(2)}) even without a shared identifier.`,
      });
    }
    log(`[pipeline] ${kase.caseNumber}: ${semantic.length} semantic match(es) >= ${threshold}`);

    // --- Step 5: AI hypothesis for every candidate pair --------------
    const candidateIds = new Set([
      ...identifierCandidates.keys(),
      ...semantic.map((s) => String(s.caseId)),
    ]);
    const otherById = new Map(others.map((o) => [String(o._id), o]));

    for (const otherId of candidateIds) {
      const other = otherById.get(otherId);
      if (!other) continue;
      const hypo = await compareCases(
        { narrative: kase.narrative, identifiers: identifiersToText(identifiers) },
        {
          narrative: other.narrative,
          identifiers: identifiersToText(other.extractedIdentifiers || {}),
        }
      );

      await upsertLink(caseId, otherId, 'ai_hypothesis', {
        matchedOn: identifierCandidates.get(otherId) || [],
        aiConnected: hypo.connected,
        aiRationale: hypo.rationale,
        aiConfidence: hypo.confidence,
        suggestedNextStep: hypo.suggested_next_step,
      });
    }
    log(`[pipeline] ${kase.caseNumber}: ${candidateIds.size} AI hypothesis pair(s)`);

    await Case.updateOne(
      { _id: caseId },
      { $set: { 'analysis.state': 'done', 'analysis.lastRunAt': new Date(), 'analysis.error': null } }
    );
  } catch (err) {
    log(`[pipeline] ${kase.caseNumber}: ERROR ${err.message}`);
    await Case.updateOne(
      { _id: caseId },
      { $set: { 'analysis.state': 'error', 'analysis.error': err.message } }
    );
    throw err;
  }
}

// Fire-and-forget wrapper used by the routes.
export function runPipelineAsync(caseId) {
  setImmediate(() => {
    runPipeline(caseId, { log: console.log }).catch((e) =>
      console.error('[pipeline] unhandled', e)
    );
  });
}
