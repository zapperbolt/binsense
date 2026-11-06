import { describe, expect, it } from 'vitest';
import items from '../src/data/items.json';
import en from '../src/i18n/en.js';
import { LANGUAGES, createTranslator, loadLanguage } from '../src/i18n/index.jsx';

const placeholders = text => (text.match(/\{\w+\}/g) || []).sort();
const others = LANGUAGES.map(l => l.code).filter(code => code !== 'en');

describe.each(others)('%s translations', code => {
  it('has exactly the same UI keys as English, all non-empty', async () => {
    const { strings } = await loadLanguage(code);
    expect(Object.keys(strings).sort()).toEqual(Object.keys(en).sort());
    for (const [key, value] of Object.entries(strings)) expect(value.trim(), key).not.toBe('');
  });
  it('keeps every {placeholder}', async () => {
    const { strings } = await loadLanguage(code);
    for (const key of Object.keys(en)) expect(placeholders(strings[key]), key).toEqual(placeholders(en[key]));
  });
  it('translates every guide item field', async () => {
    const { items: tr } = await loadLanguage(code);
    expect(Object.keys(tr).sort()).toEqual(items.map(i => i.id).sort());
    for (const item of items) {
      for (const field of ['name', 'material', 'answer', 'instruction', 'tip']) expect(tr[item.id][field]?.trim(), `${item.id}.${field}`).toBeTruthy();
    }
  });
});

describe('createTranslator', () => {
  it('fills placeholders', () => {
    expect(createTranslator('en').t('nearby.kmAway', { km: '1.5' })).toBe('1.5 km away');
  });
  it('picks singular and plural forms', () => {
    const { tn } = createTranslator('en');
    expect(tn('det.found', 1)).toMatch(/^Found 1 item ·/);
    expect(tn('det.found', 3)).toMatch(/^Found 3 items ·/);
  });
  it('falls back to English, then to the key', () => {
    const { t } = createTranslator('zh', { strings: {}, items: {} });
    expect(t('nav.scan')).toBe('Scan');
    expect(t('no.such.key')).toBe('no.such.key');
  });
  it('does not treat inherited names like toString as placeholder values', () => {
    expect(createTranslator('en', { strings: { x: 'a {toString} b' }, items: {} }).t('x')).toBe('a {toString} b');
  });
  it('localizes items and keeps non-text fields', async () => {
    const pack = await loadLanguage('zh');
    const bottle = createTranslator('zh', pack).localizeItem(items[0]);
    expect(bottle.name).not.toBe(items[0].name);
    expect(bottle).toMatchObject({ id: items[0].id, category: items[0].category, emoji: items[0].emoji });
  });
  it('returns English for unknown languages', async () => {
    expect((await loadLanguage('fr')).strings).toBe(en);
    expect((await loadLanguage('toString')).strings).toBe(en);
  });
});
