// Rule-based identifier extraction from free text.
// Tuned for Indian cybercrime case narratives (UPI, IFSC, 10-digit mobile).

const PATTERNS = {
  // 10-digit Indian mobile, optionally prefixed with +91 / 0. Avoid matching
  // longer digit runs (account numbers) via boundaries.
  phones: /(?:(?:\+?91[- ]?)|0)?([6-9]\d{9})(?!\d)/g,
  emails: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  // IFSC: 4 letters, 0, 6 alphanumerics.
  ifscCodes: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
  // UPI VPA: handle@bank — restrict TLD-like part to known-ish PSP suffixes.
  upiIds: /\b[A-Za-z0-9._-]{2,}@(?:okhdfcbank|okicici|oksbi|okaxis|ybl|paytm|apl|ibl|axl|upi|hdfcbank|sbi|icici|axisbank)\b/gi,
  urls: /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi,
  // Bank account numbers: 9-18 digit runs standing alone.
  accountNumbers: /(?<!\d)(\d{9,18})(?!\d)/g,
  // Device / IMEI: 15-digit IMEI or explicit "device id: XXXX".
  deviceIds: /\b(?:IMEI[:\s]*)?(\d{15})\b|device\s*id[:\s]*([A-Za-z0-9-]{6,})/gi,
};

function uniqNormalized(values, transform = (s) => s) {
  return [
    ...new Set(
      values
        .filter((v) => typeof v === 'string')
        .map((v) => transform(v.trim()))
    ),
  ].filter(Boolean);
}

export function extractIdentifiers(text = '') {
  const src = String(text || '');

  const phones = uniqNormalized(
    [...src.matchAll(PATTERNS.phones)].map((m) => m[1])
  );

  const emails = uniqNormalized(
    [...src.matchAll(PATTERNS.emails)].map((m) => m[0]),
    (s) => s.toLowerCase()
  );

  const ifscCodes = uniqNormalized(
    [...src.matchAll(PATTERNS.ifscCodes)].map((m) => m[0]),
    (s) => s.toUpperCase()
  );

  const upiIds = uniqNormalized(
    [...src.matchAll(PATTERNS.upiIds)].map((m) => m[0]),
    (s) => s.toLowerCase()
  );

  const urls = uniqNormalized(
    [...src.matchAll(PATTERNS.urls)].map((m) => m[0]),
    (s) => s.replace(/[.,);]+$/, '')
  );

  // Account numbers: exclude anything already captured as a phone or IMEI.
  const phoneSet = new Set(phones);
  const accountNumbers = uniqNormalized(
    [...src.matchAll(PATTERNS.accountNumbers)].map((m) => m[1])
  ).filter((n) => n.length !== 10 || !phoneSet.has(n));

  const deviceIds = uniqNormalized(
    [...src.matchAll(PATTERNS.deviceIds)].map((m) => m[1] || m[2]).filter(Boolean)
  );

  return { phones, emails, accountNumbers, ifscCodes, upiIds, deviceIds, urls };
}

// Human-readable labels for a link's matchedOn array.
export const IDENTIFIER_LABELS = {
  phones: 'phone',
  emails: 'email',
  accountNumbers: 'account',
  ifscCodes: 'IFSC',
  upiIds: 'UPI',
  deviceIds: 'device',
  urls: 'URL',
};

// Given two identifier bags, return the overlapping values labelled by kind.
export function sharedIdentifiers(a = {}, b = {}) {
  const matches = [];
  for (const key of Object.keys(IDENTIFIER_LABELS)) {
    const setB = new Set((b[key] || []).map((v) => v.toLowerCase()));
    for (const value of a[key] || []) {
      if (setB.has(value.toLowerCase())) {
        matches.push(`${IDENTIFIER_LABELS[key]}: ${value}`);
      }
    }
  }
  return matches;
}

// Flatten an identifier bag to a single string for embedding context.
export function identifiersToText(bag = {}) {
  return Object.entries(bag)
    .filter(([, v]) => Array.isArray(v) && v.length)
    .map(([k, v]) => `${k}: ${v.join(', ')}`)
    .join(' | ');
}
