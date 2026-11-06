// Prints the most common "Gemini said X, person said Y" corrections.
// Usage: pnpm corrections:summary   (reads DATA_DIR/corrections.json, default ./data)
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { summarizeCorrections } from '../server/corrections.js';

const file = path.resolve(process.env.DATA_DIR || 'data', 'corrections.json');
let records = [];
try { records = JSON.parse(await readFile(file, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!records.length) console.log(`No corrections yet (${file}).`);
else {
  console.log(`${records.length} corrections in ${file}\n`);
  for (const { pair, count } of summarizeCorrections(records)) console.log(`${String(count).padStart(4)}  ${pair}`);
}
