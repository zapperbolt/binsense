import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './server/app.js';
import { createJsonStore } from './server/store.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Look for .env next to this file first, then one folder up (for setups where
// the app lives in a subfolder). dotenv does not override values already set,
// so the first file that defines a variable wins. Hosting platforms set real
// environment variables instead, which also win over .env files.
dotenv.config({ path: [path.resolve(here, '.env'), path.resolve(here, '../.env')], quiet: true });

// Local default: 127.0.0.1 (only this computer can connect).
// Hosting platforms set HOST=0.0.0.0 and PORT themselves.
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || process.env.BINSENSE_PORT || 5051);
const dataDir = path.resolve(here, process.env.DATA_DIR || 'data');

const app = createApp({
  apiKey: process.env.GEMINI_API_KEY || '',
  model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  distDir: path.join(here, 'dist'),
  // Number of proxies in front of the app (1 on Render). 0/unset locally.
  trustProxy: Number(process.env.TRUST_PROXY || 0),
  reportStore: await createJsonStore(path.join(dataDir, 'reports.json')),
  correctionStore: await createJsonStore(path.join(dataDir, 'corrections.json')),
  photoDir: path.join(dataDir, 'report-photos'),
});
app.listen(port, host, () => console.log(`BinSense available on http://${host}:${port}`));
