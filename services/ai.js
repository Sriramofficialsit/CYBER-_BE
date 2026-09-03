// ---------------------------------------------------------------------------
// AI service — the ONLY place a cloud LLM is called.
//
// Backend: Google Gemini (Generative Language API) over plain REST, so there is
// no SDK version to track. Every embedding / reasoning request goes through this
// module so it can be swapped for a self-hosted model (vLLM / Ollama) later
// without touching routes, models, or the pipeline. See README "Swapping the
// AI backend".
//
// If GEMINI_API_KEY is not set — OR if a Gemini call fails (bad key, quota,
// rate limit, offline) — a deterministic local mock is used instead, so the
// prototype always runs, fully offline, for demos.
// ---------------------------------------------------------------------------
import crypto from 'crypto';

const API_KEY = process.env.GEMINI_API_KEY || '';
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.0-flash';
const API_BASE =
  process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
const MOCK_DIM = 384;

const hasKey = Boolean(API_KEY);

// Flipped to false the first time a live Gemini call fails. From then on every
// call uses the mock — one broken key must not break the whole app.
let apiHealthy = hasKey;

function markApiDown(where, err) {
  if (apiHealthy) {
    console.warn(
      `[ai] Gemini call failed in ${where} (${err.message}). ` +
        `Falling back to the local mock for the rest of this run. ` +
        `Fix GEMINI_API_KEY / quota, or clear it to silence this.`
    );
  }
  apiHealthy = false;
}

// 'gemini' only while the key is set AND no call has failed yet.
export function aiMode() {
  return hasKey && apiHealthy ? 'gemini' : 'mock';
}

// Default cosine threshold the pipeline should use for the ACTIVE backend. The
// mock bag-of-words embedding lives on a different scale than a real transformer
// embedding, so it needs a lower bar.
export function defaultSimilarityThreshold() {
  return aiMode() === 'gemini' ? 0.75 : 0.45;
}

// --- Gemini REST helpers -------------------------------------------------

async function geminiFetch(path, body) {
  const res = await fetch(`${API_BASE}/${path}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${text.slice(0, 300)}`);
  }
  return res.json();
}

// --- Mock helpers ----------------------------------------------------------

const STOP = new Set([
  'the', 'and', 'was', 'for', 'that', 'with', 'from', 'this', 'his', 'her',
  'she', 'they', 'were', 'have', 'has', 'had', 'not', 'but', 'after', 'when',
  'then', 'told', 'said', 'complainant', 'victim', 'reported', 'case', 'him',
  'who', 'her', 'a', 'an', 'to', 'of', 'in', 'on', 'at', 'by', 'it', 'is',
  'as', 'be', 'or', 'he', 'she', 'per', 'via', 'rs', 'later', 'first', 'once',
  'about', 'into', 'over', 'out', 'up', 'down', 'off', 'more', 'been', 'would',
  'could', 'which', 'while', 'within', 'without', 'then', 'than', 'them',
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9@.\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function bump(vec, term, weight) {
  const h = crypto.createHash('md5').update(term).digest();
  vec[h.readUInt16BE(0) % MOCK_DIM] += weight;
  vec[h.readUInt16BE(2) % MOCK_DIM] += weight * 0.5; // second probe cuts collisions
}

function mockEmbedding(text) {
  const vec = new Array(MOCK_DIM).fill(0);
  const toks = tokenize(text);
  // Positive hashed bag-of-words + word bigrams. Shared vocabulary AND shared
  // phrasing push cosine up, which is what "reads alike" should mean.
  for (let i = 0; i < toks.length; i += 1) {
    bump(vec, toks[i], 1);
    if (i + 1 < toks.length) bump(vec, `${toks[i]} ${toks[i + 1]}`, 1.6);
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function mockHypothesis(caseAText, caseBText) {
  const a = new Set(tokenize(caseAText));
  const b = new Set(tokenize(caseBText));
  const signal = [...a].filter((t) => b.has(t));
  const ratio = signal.length / Math.max(6, Math.min(a.size, b.size));

  const connected = ratio >= 0.15;
  const confidence = ratio >= 0.35 ? 'high' : ratio >= 0.2 ? 'medium' : 'low';

  const cited = signal.slice(0, 6).join(', ') || 'overlapping wording';
  const rationale = connected
    ? `Both narratives share notable details (${cited}), suggesting a common modus operandi or actor. The framing of how the victim was approached and pressured reads similarly across the two files.`
    : `The two narratives do not share meaningful specifics beyond generic fraud vocabulary (${cited}). No common actor, channel, or method is evident from the text.`;

  return {
    connected,
    rationale,
    confidence,
    suggested_next_step: connected
      ? 'Cross-check the phone numbers, bank accounts, and payee UPI IDs from both cases against each other and against the NCRP database.'
      : 'No joint action recommended; handle the cases independently.',
    _mock: true,
  };
}

// --- Public API ----------------------------------------------------------

/**
 * Embed a single string. Returns { vector, model }.
 */
export async function embedText(text) {
  const mock = () => ({
    vector: mockEmbedding(text),
    model: `mock-embedding-${MOCK_DIM}`,
  });
  if (!hasKey || !apiHealthy) return mock();
  try {
    const data = await geminiFetch(`models/${EMBEDDING_MODEL}:embedContent`, {
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: String(text || '').slice(0, 8000) }] },
    });
    const vector = data?.embedding?.values;
    if (!Array.isArray(vector) || !vector.length) {
      throw new Error('empty embedding in response');
    }
    return { vector, model: EMBEDDING_MODEL };
  } catch (err) {
    markApiDown('embedText', err);
    return mock();
  }
}

const SYSTEM_PROMPT = `You are assisting a police cybercrime investigator by comparing two case files for possible connection. You are not making a legal determination — you are proposing a hypothesis for a human officer to verify. Be specific and cite what in the text supports your reasoning. If the cases are not meaningfully connected, say so.`;

/**
 * Compare two cases and propose a linkage hypothesis.
 * @returns {{connected: boolean, rationale: string, confidence: 'low'|'medium'|'high', suggested_next_step: string}}
 */
export async function compareCases(caseA, caseB) {
  const caseAText = `${caseA.narrative}\nIdentifiers: ${caseA.identifiers || ''}`;
  const caseBText = `${caseB.narrative}\nIdentifiers: ${caseB.identifiers || ''}`;

  if (!hasKey || !apiHealthy) return mockHypothesis(caseAText, caseBText);

  let raw;
  try {
    const data = await geminiFetch(`models/${CHAT_MODEL}:generateContent`, {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                `Case A: ${caseAText}\n\nCase B: ${caseBText}\n\n` +
                `Return JSON: {\n` +
                `  "connected": boolean,\n` +
                `  "rationale": "2-3 sentences, plain language, citing specific shared details",\n` +
                `  "confidence": "low" | "medium" | "high",\n` +
                `  "suggested_next_step": "one concrete investigative action"\n` +
                `}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });
    raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error('no text in Gemini response');
  } catch (err) {
    markApiDown('compareCases', err);
    return mockHypothesis(caseAText, caseBText);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      connected: false,
      rationale: 'AI response could not be parsed.',
      confidence: 'low',
      suggested_next_step: 'Review the two cases manually.',
    };
  }
  return {
    connected: Boolean(parsed.connected),
    rationale: String(parsed.rationale || ''),
    confidence: ['low', 'medium', 'high'].includes(parsed.confidence)
      ? parsed.confidence
      : 'low',
    suggested_next_step: String(parsed.suggested_next_step || ''),
  };
}
