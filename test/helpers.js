import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { createJsonStore } from '../server/store.js';

// Very high limits so ordinary tests never hit them; rate-limit tests pass
// their own small limits.
const relaxed = { windowMs: 60_000, limit: 10_000 };
export const RELAXED_LIMITS = { analyze: relaxed, chat: relaxed, reportWrite: relaxed, correction: relaxed, read: relaxed };

// Starts the real Express app on a random free port (port 0) with fresh
// stores in a temp folder. No network access is needed: pass a fake
// fetchImpl to stand in for Gemini / data.gov.sg.
export async function startServer(options = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'binsense-test-'));
  const reportStore = await createJsonStore(path.join(dataDir, 'reports.json'));
  const correctionStore = await createJsonStore(path.join(dataDir, 'corrections.json'));
  const app = createApp({ reportStore, correctionStore, photoDir: path.join(dataDir, 'photos'), limits: RELAXED_LIMITS, ...options });
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, dataDir, reportStore, correctionStore, close: () => new Promise(resolve => server.close(resolve)) };
}

export const postJson = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

// A fake fetch that answers like the Gemini API with the given JSON text.
export function fakeGemini(jsonText, { status = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: jsonText }] } }] }), { status });
  };
  return { fetchImpl, calls };
}
