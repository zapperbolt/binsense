import { afterEach, describe, expect, it } from 'vitest';
import { readLocalArray, writeLocal } from '../src/lib/storage.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}
afterEach(() => { delete globalThis.localStorage; });

describe('readLocalArray', () => {
  it('returns the stored array', () => {
    globalThis.localStorage = fakeStorage({ k: '[1,2]' });
    expect(readLocalArray('k')).toEqual([1, 2]);
  });
  it.each([['{}'], ['"text"'], ['null'], ['{broken']])('falls back to [] for %s', stored => {
    globalThis.localStorage = fakeStorage({ k: stored });
    expect(readLocalArray('k')).toEqual([]);
  });
  it('falls back to [] when localStorage is unavailable', () => {
    expect(readLocalArray('k')).toEqual([]);
  });
});

describe('writeLocal', () => {
  it('does not throw when storage is full or blocked', () => {
    globalThis.localStorage = { setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(() => writeLocal('k', [1])).not.toThrow();
  });
});
