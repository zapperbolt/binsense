import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

// A tiny append-only record store backed by one JSON file.
// Good enough for a hackathon (hundreds to a few thousand records); swap
// this for a real database later without changing the routes, because they
// only use add() and list().
//
// Writes are queued so two requests can't interleave and corrupt the file,
// and each write goes to a temp file first and is then renamed over the old
// one, so a crash mid-write never leaves half a JSON file behind.
export async function createJsonStore(filePath, { maxRecords = 5000 } = {}) {
  await mkdir(path.dirname(filePath), { recursive: true });
  let records = [];
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8'));
    if (Array.isArray(parsed)) records = parsed;
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`Could not read ${filePath}; starting empty.`, error.message);
  }

  let queue = Promise.resolve();
  const persist = () => {
    const write = queue.then(async () => {
      const tmp = `${filePath}.tmp`;
      await writeFile(tmp, JSON.stringify(records));
      await rename(tmp, filePath);
    });
    // The caller sees this write's error, but the queue itself must keep
    // going: if we stored the rejected promise, every later write would
    // fail too, even after the disk problem was fixed.
    queue = write.catch(() => {});
    return write;
  };

  return {
    list: () => records.slice(),
    async add(record) {
      records.push(record);
      // Oldest records are dropped first so the file can't grow forever.
      if (records.length > maxRecords) records = records.slice(-maxRecords);
      try {
        await persist();
      } catch (error) {
        // Not saved, so don't show it either: memory must match the file.
        records = records.filter(r => r !== record);
        throw error;
      }
      return record;
    },
  };
}
