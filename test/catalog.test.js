import { describe, expect, it } from 'vitest';
import items from '../src/data/items.json';
import { allowedIds, buildCatalog } from '../server/catalog.js';

describe('catalog', () => {
  it('server allows exactly the item IDs in items.json', () => {
    expect([...allowedIds].sort()).toEqual(items.map(i => i.id).sort());
  });
  it('item IDs are unique', () => {
    expect(new Set(items.map(i => i.id)).size).toBe(items.length);
  });
  it('fails loudly when an item has no visual clues', () => {
    expect(() => buildCatalog([...items, { id: 'mystery', name: 'Mystery' }])).toThrow(/Missing visual clues: \[mystery\]/);
  });
  it('fails loudly when clues reference an unknown item', () => {
    expect(() => buildCatalog(items.slice(1))).toThrow(/unknown items: \[plastic-bottle\]/);
  });
});
