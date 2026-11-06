import { describe, expect, it } from 'vitest';
import { MAX_DETECTIONS, analyzePrompt, analyzeSchema, languageName, parseDetections, toBox } from '../server/gemini.js';

const ids = new Set(['plastic-bottle', 'tissue']);
const row = (over = {}) => ({ item_id: 'plastic-bottle', label: 'clear bottle, left', confidence: 'high', box_2d: [100, 200, 500, 400], condition: 'not_empty', ...over });
const parse = rows => parseDetections(JSON.stringify({ items: rows, description: 'desk' }), ids);

describe('toBox', () => {
  it('converts [ymin, xmin, ymax, xmax] in 0-1000 to fractions', () => {
    expect(toBox([100, 200, 500, 400])).toEqual({ top: 0.1, left: 0.2, bottom: 0.5, right: 0.4 });
  });
  it('clamps slightly out-of-range values', () => {
    expect(toBox([-5, 0, 1010, 1000])).toEqual({ top: 0, left: 0, bottom: 1, right: 1 });
  });
  it.each([
    ['missing', undefined],
    ['wrong length', [1, 2, 3]],
    ['non-numeric', [1, 'a', 3, 4]],
    ['NaN', [1, NaN, 3, 4]],
    ['inverted', [500, 200, 100, 400]],
    ['zero-width', [100, 200, 500, 200]],
    ['object', { ymin: 1 }],
  ])('returns null for %s boxes', (_name, raw) => {
    expect(toBox(raw)).toBeNull();
  });
});

describe('parseDetections', () => {
  it('keeps a valid detection with its label and box', () => {
    expect(parse([row()]).items).toEqual([{ item_id: 'plastic-bottle', label: 'clear bottle, left', confidence: 'high', box: { top: 0.1, left: 0.2, bottom: 0.5, right: 0.4 }, condition: 'not_empty' }]);
  });
  it('keeps the item but sets box to null when the box is invalid', () => {
    const [item] = parse([row({ box_2d: [9, 9, 1, 1] })]).items;
    expect(item.item_id).toBe('plastic-bottle');
    expect(item.box).toBeNull();
  });
  it('keeps two separate objects with the same ID', () => {
    expect(parse([row(), row({ label: 'green bottle, right' })]).items).toHaveLength(2);
  });
  it('drops unknown IDs and invalid confidence values', () => {
    const items = parse([row({ item_id: 'rocket' }), row({ confidence: 'low' }), row({ item_id: 'tissue' })]).items;
    expect(items.map(i => i.item_id)).toEqual(['tissue']);
  });
  it('drops null rows and tolerates a missing items array', () => {
    expect(parse([null, row()]).items).toHaveLength(1);
    expect(parseDetections('{"description":"empty table"}', ids)).toEqual({ items: [], description: 'empty table' });
  });
  it(`caps results at ${MAX_DETECTIONS} after filtering`, () => {
    const rows = [row({ item_id: 'rocket' }), ...Array.from({ length: 20 }, () => row())];
    expect(parse(rows).items).toHaveLength(MAX_DETECTIONS);
  });
  it('trims and shortens labels', () => {
    const [item] = parse([row({ label: `  ${'x'.repeat(100)}  ` })]).items;
    expect(item.label).toHaveLength(60);
  });
  it('treats a missing label as an empty string', () => {
    expect(parse([row({ label: undefined })]).items[0].label).toBe('');
  });
  it.each([[undefined], ['dirty'], ['toString']])('turns unknown condition %s into cannot_tell', condition => {
    expect(parse([row({ condition })]).items[0].condition).toBe('cannot_tell');
  });
  it('throws on non-JSON so the route can return 502', () => {
    expect(() => parseDetections('oops', ids)).toThrow(SyntaxError);
  });
});

describe('analyzeSchema', () => {
  it('restricts item_id to the catalog and requires a box and label', () => {
    const item = analyzeSchema(ids).properties.items.items;
    expect(item.properties.item_id.enum).toEqual([...ids]);
    expect(item.required).toEqual(expect.arrayContaining(['label', 'box_2d']));
  });
});

describe('languages', () => {
  it.each([['zh', 'Simplified Chinese'], ['ms', 'Malay'], ['ta', 'Tamil'], ['en', 'English']])('%s → %s', (code, name) => {
    expect(languageName(code)).toBe(name);
  });
  it.each([[undefined], ['fr'], ['toString'], ['__proto__']])('falls back to English for %s', code => {
    expect(languageName(code)).toBe('English');
  });
  it('asks for labels in the chosen language', () => {
    expect(analyzePrompt([], 'ta')).toContain('Write the label in Tamil.');
  });
});
