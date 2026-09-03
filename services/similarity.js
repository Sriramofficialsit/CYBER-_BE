// Brute-force cosine similarity for the prototype.
// Swap for MongoDB Atlas Vector Search or a vector DB (Qdrant) at scale.

export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * @param {number[]} target                  query vector
 * @param {{caseId: any, vector: number[]}[]} others
 * @param {{threshold?: number, topK?: number}} opts
 * @returns {{caseId: any, score: number}[]} sorted desc, filtered by threshold
 */
export function topSimilar(target, others, opts = {}) {
  const threshold = opts.threshold ?? 0.78;
  const topK = opts.topK ?? 5;
  return others
    .map((o) => ({ caseId: o.caseId, score: cosineSimilarity(target, o.vector) }))
    .filter((r) => r.score >= threshold)
    .sort((x, y) => y.score - x.score)
    .slice(0, topK);
}
