import { describe, expect, it } from 'vitest';
import items from '../src/data/items.json';
import { NOT_LISTED, applyCorrection, badgeKey, collectionCategoryFor, conditionAdviceKey, countByGroup, disposalGroup, enrichDetections, filterDetections } from '../src/lib/sorting.js';

const byId = id => items.find(item => item.id === id);
const itemsById = new Map(items.map(item => [item.id, item]));

describe('collectionCategoryFor', () => {
  it.each(['battery', 'phone', 'light-bulb', 'laptop', 'power-bank'])('sends %s to e-waste, never blue recycling', id => {
    expect(collectionCategoryFor(byId(id))).toBe('ewaste');
  });
  it('sends clothing to textile collection', () => {
    expect(collectionCategoryFor(byId('clothing'))).toBe('textile');
  });
  it('offers no collection point for general waste or compost', () => {
    for (const item of items.filter(i => i.category === 'general' || i.category === 'compost')) {
      expect(collectionCategoryFor(item), item.id).toBeNull();
    }
  });
  it('covers every category used in items.json', () => {
    const known = new Set(['recycle', 'special', 'textile', 'general', 'compost']);
    for (const item of items) expect(known.has(item.category), item.id).toBe(true);
  });
});

const detect = (item_id, label = '') => ({ item_id, label, confidence: 'high', box: null });

describe('disposalGroup', () => {
  it.each([
    ['plastic-bottle', 'recyclable'],
    ['tissue', 'rubbish'], ['styrofoam', 'rubbish'], ['food-stained-paper', 'rubbish'], ['ceramic-cookware', 'rubbish'], ['banana-peel', 'rubbish'],
    ['battery', 'special'], ['clothing', 'special'],
  ])('%s → %s', (id, group) => { expect(disposalGroup(byId(id))).toBe(group); });
  it('treats an unknown category as rubbish rather than recyclable (fail safe)', () => {
    expect(disposalGroup({ category: 'mystery' })).toBe('rubbish');
  });
});

describe('detections', () => {
  const enriched = enrichDetections([detect('plastic-bottle'), detect('unknown'), detect('tissue'), detect('battery'), detect('styrofoam')], itemsById);
  it('drops unknown IDs and numbers the rest consecutively', () => {
    expect(enriched.map(d => [d.number, d.item_id])).toEqual([[1, 'plastic-bottle'], [2, 'tissue'], [3, 'battery'], [4, 'styrofoam']]);
  });
  it('counts recyclable, rubbish and special items', () => {
    expect(countByGroup(enriched)).toEqual({ recyclable: 1, rubbish: 2, special: 1, unknown: 0 });
  });
  it('filters while keeping the original numbers so they still match the photo', () => {
    expect(filterDetections(enriched, 'rubbish').map(d => d.number)).toEqual([2, 4]);
    expect(filterDetections(enriched, 'all')).toHaveLength(4);
  });
  it('handles missing input', () => { expect(enrichDetections(undefined, itemsById)).toEqual([]); });
});

describe('conditionAdviceKey', () => {
  const d = (category, condition) => ({ group: disposalGroup({ category }), condition });
  it('asks to empty or rinse recyclables', () => {
    expect(conditionAdviceKey(d('recycle', 'not_empty'))).toBe('cond.not_empty');
    expect(conditionAdviceKey(d('recycle', 'food_residue'))).toBe('cond.food_residue');
  });
  it('says nothing for clean or unclear recyclables', () => {
    expect(conditionAdviceKey(d('recycle', 'looks_clean'))).toBeNull();
    expect(conditionAdviceKey(d('recycle', 'cannot_tell'))).toBeNull();
  });
  it('says nothing for items that are not going in the blue bin anyway', () => {
    expect(conditionAdviceKey(d('general', 'food_residue'))).toBeNull();
    expect(conditionAdviceKey(d('special', 'not_empty'))).toBeNull();
  });
});

describe('applyCorrection', () => {
  const start = enrichDetections([detect('plastic-bottle', 'blue bottle'), detect('tissue')], itemsById);
  it('replaces the item, keeps number/label/box and remembers the original', () => {
    const [first, second] = applyCorrection(start, 1, 'shampoo-bottle', itemsById);
    expect(first).toMatchObject({ number: 1, item_id: 'shampoo-bottle', label: 'blue bottle', group: 'recyclable', corrected: true, originalId: 'plastic-bottle' });
    expect(second).toBe(start[1]);
  });
  it('keeps the very first prediction as originalId after two corrections', () => {
    const twice = applyCorrection(applyCorrection(start, 1, 'shampoo-bottle', itemsById), 1, 'glass-jar', itemsById);
    expect(twice[0].originalId).toBe('plastic-bottle');
  });
  it('marks "not listed" items as unknown with no guide item', () => {
    const [first] = applyCorrection(start, 1, NOT_LISTED, itemsById);
    expect(first).toMatchObject({ item: null, item_id: NOT_LISTED, group: 'unknown' });
    expect(countByGroup([first]).unknown).toBe(1);
    expect(badgeKey(first.item)).toBe('badge.unknown');
  });
  it('does not mutate the original list', () => {
    applyCorrection(start, 1, NOT_LISTED, itemsById);
    expect(start[0].item_id).toBe('plastic-bottle');
  });
});

describe('badgeKey', () => {
  it.each(['recycle', 'general', 'compost', 'special', 'textile'])('has a badge for %s', category => {
    expect(badgeKey({ category })).toBe(`badge.${category}`);
  });
  it('falls back to the general-waste badge for unknown categories', () => {
    expect(badgeKey({ category: 'mystery' })).toBe('badge.general');
  });
});
