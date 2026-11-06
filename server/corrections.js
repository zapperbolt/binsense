// "Wrong item?" feedback. Each correction records what Gemini said and what
// the person says it really is. Collected over time, these become a labelled
// test set for measuring and improving the photo prompt.

export const NOT_LISTED = 'not-listed';

export function validateCorrection(body, allowedIds) {
  const { predicted, corrected, label = '', confidence } = body || {};
  if (!allowedIds.has(predicted)) return { ok: false, error: 'Unknown predicted item.' };
  if (corrected !== NOT_LISTED && !allowedIds.has(corrected)) return { ok: false, error: 'Choose the correct item.' };
  if (corrected === predicted) return { ok: false, error: 'The correction is the same as the prediction.' };
  if (typeof label !== 'string') return { ok: false, error: 'Label must be text.' };
  return {
    ok: true,
    correction: {
      predicted,
      corrected,
      label: label.replace(/\s+/g, ' ').trim().slice(0, 60),
      confidence: ['high', 'medium'].includes(confidence) ? confidence : null,
    },
  };
}

// Counts "predicted -> corrected" pairs, most common first. Used by
// scripts/corrections-summary.js to see which mistakes Gemini makes most.
export function summarizeCorrections(records) {
  const counts = new Map();
  for (const r of records) {
    const key = `${r.predicted} -> ${r.corrected}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts].map(([pair, count]) => ({ pair, count })).sort((a, b) => b.count - a.count || a.pair.localeCompare(b.pair));
}
