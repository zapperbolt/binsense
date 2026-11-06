import { describe, expect, it } from 'vitest';
import { NOT_LISTED, summarizeCorrections, validateCorrection } from '../server/corrections.js';

const ids = new Set(['plastic-bottle', 'shampoo-bottle', 'tissue']);

describe('validateCorrection', () => {
  it('accepts a change to another catalog item', () => {
    expect(validateCorrection({ predicted: 'plastic-bottle', corrected: 'shampoo-bottle', label: ' blue  bottle ', confidence: 'high' }, ids))
      .toEqual({ ok: true, correction: { predicted: 'plastic-bottle', corrected: 'shampoo-bottle', label: 'blue bottle', confidence: 'high' } });
  });
  it('accepts "not listed"', () => {
    expect(validateCorrection({ predicted: 'tissue', corrected: NOT_LISTED }, ids).ok).toBe(true);
  });
  it.each([
    ['unknown prediction', { predicted: 'rocket', corrected: 'tissue' }],
    ['unknown correction', { predicted: 'tissue', corrected: 'rocket' }],
    ['no change', { predicted: 'tissue', corrected: 'tissue' }],
    ['non-text label', { predicted: 'tissue', corrected: NOT_LISTED, label: ['x'] }],
  ])('rejects %s', (_n, body) => { expect(validateCorrection(body, ids).ok).toBe(false); });
  it('drops an invalid confidence value instead of storing it', () => {
    expect(validateCorrection({ predicted: 'tissue', corrected: NOT_LISTED, confidence: 'certain' }, ids).correction.confidence).toBeNull();
  });
});

describe('summarizeCorrections', () => {
  it('counts pairs, most common first', () => {
    const rows = [['a', 'b'], ['a', 'b'], ['c', 'd']].map(([predicted, corrected]) => ({ predicted, corrected }));
    expect(summarizeCorrections(rows)).toEqual([{ pair: 'a -> b', count: 2 }, { pair: 'c -> d', count: 1 }]);
  });
});
