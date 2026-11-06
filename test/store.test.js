import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createJsonStore } from '../server/store.js';

const tempFile = async () => path.join(await mkdtemp(path.join(tmpdir(), 'binsense-')), 'nested', 'records.json');

describe('createJsonStore', () => {
  it('persists records and reloads them', async () => {
    const file = await tempFile();
    const store = await createJsonStore(file);
    await store.add({ id: 1 });
    await store.add({ id: 2 });
    const reopened = await createJsonStore(file);
    expect(reopened.list()).toEqual([{ id: 1 }, { id: 2 }]);
  });
  it('survives many concurrent writes without losing any', async () => {
    const file = await tempFile();
    const store = await createJsonStore(file);
    await Promise.all(Array.from({ length: 50 }, (_, i) => store.add({ i })));
    expect(JSON.parse(await readFile(file, 'utf8'))).toHaveLength(50);
  });
  it('keeps only the newest maxRecords', async () => {
    const store = await createJsonStore(await tempFile(), { maxRecords: 3 });
    for (let i = 0; i < 5; i += 1) await store.add({ i });
    expect(store.list().map(r => r.i)).toEqual([2, 3, 4]);
  });
  it('starts empty if the file is corrupt', async () => {
    const file = await tempFile();
    await createJsonStore(file);
    await writeFile(file, '{not json');
    expect((await createJsonStore(file)).list()).toEqual([]);
  });
  it('list() returns a copy callers cannot mutate', async () => {
    const store = await createJsonStore(await tempFile());
    store.list().push({ sneaky: true });
    expect(store.list()).toEqual([]);
  });
});

describe('createJsonStore after a failed write', () => {
  it('rejects that add, forgets the record, and keeps working once the problem is gone', async () => {
    const { mkdir, rm } = await import('node:fs/promises');
    const file = await tempFile();
    const store = await createJsonStore(file);
    // Make the temp-file path a directory so writeFile fails (EISDIR).
    await mkdir(`${file}.tmp`);
    await expect(store.add({ id: 'lost' })).rejects.toThrow();
    expect(store.list()).toEqual([]);
    await rm(`${file}.tmp`, { recursive: true });
    await store.add({ id: 'ok' });
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual([{ id: 'ok' }]);
  });
});
