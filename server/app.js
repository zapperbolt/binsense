import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { catalog, allowedIds } from './catalog.js';
import { datasets, normalizeLocations } from './locations.js';
import { analyzePrompt, analyzeSchema, isLanguage, languageName, parseDetections } from './gemini.js';
import { isReportId, publicReports, validateReport } from './reports.js';
import { validateCorrection } from './corrections.js';

const CACHE_MS = 6 * 60 * 60 * 1000;
const geminiUrl = model => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

// Requests allowed per IP address per window. Gemini calls cost money and
// quota, so they get the tightest limits; reads are generous.
export const DEFAULT_LIMITS = {
  analyze: { windowMs: 10 * 60 * 1000, limit: 20 },
  chat: { windowMs: 10 * 60 * 1000, limit: 40 },
  reportWrite: { windowMs: 60 * 60 * 1000, limit: 10 },
  correction: { windowMs: 60 * 60 * 1000, limit: 60 },
  read: { windowMs: 60 * 1000, limit: 120 },
};

// Express 4 does not catch errors thrown inside async handlers: an unhandled
// rejection would crash the whole server. This forwards them to the error
// handler at the bottom, which answers 500 instead.
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const limiter = ({ windowMs, limit }) => rateLimit({
  windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a few minutes and try again.' },
});

// Builds the Express app without starting it. Dependencies (API key, fetch,
// stores) are passed in so tests can run the real routes against fakes.
export function createApp({
  apiKey = '', model = 'gemini-3.8-flash', fetchImpl = fetch, distDir,
  reportStore, correctionStore, photoDir, trustProxy = false, limits = DEFAULT_LIMITS,
} = {}) {
  const app = express();
  const cache = new Map();

  // Behind a hosting proxy every request appears to come from the proxy's IP.
  // trust proxy tells Express to read the real client IP from X-Forwarded-For,
  // otherwise all users would share one rate-limit bucket.
  app.set('trust proxy', trustProxy);
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // Leaflet positions map tiles with inline styles.
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        // Only force https when deployed behind an HTTPS proxy. Locally (or on
        // a LAN over plain http) it would rewrite every request to https and
        // break the app.
        upgradeInsecureRequests: trustProxy ? [] : null,
      },
    },
  }));

  // Body size limits per route: only photo uploads may be large.
  const smallJson = express.json({ limit: '20kb' });
  const photoJson = express.json({ limit: '18mb' });
  const reportJson = express.json({ limit: '3mb' });

  async function getDataset(datasetId) {
    const cached = cache.get(datasetId);
    if (cached && Date.now() - cached.time < CACHE_MS) return cached.data;
    const ticketResponse = await fetchImpl(`https://api-open.data.gov.sg/v1/public/api/datasets/${datasetId}/poll-download`, { signal: AbortSignal.timeout(30000) });
    if (!ticketResponse.ok) throw new Error('Dataset ticket unavailable');
    const ticket = await ticketResponse.json();
    const url = ticket?.data?.url;
    if (ticket.code !== 0 || !url) throw new Error('Dataset download unavailable');
    const geoResponse = await fetchImpl(url, { signal: AbortSignal.timeout(45000) });
    if (!geoResponse.ok) throw new Error('Dataset download unavailable');
    const geojson = await geoResponse.json();
    cache.set(datasetId, { time: Date.now(), data: geojson });
    return geojson;
  }

  async function callGemini(body, timeoutMs) {
    const upstream = await fetchImpl(geminiUrl(model), {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(timeoutMs), body: JSON.stringify(body),
    });
    if (!upstream.ok) return { status: upstream.status };
    const payload = await upstream.json();
    return { text: payload.candidates?.[0]?.content?.parts?.find(part => part.text)?.text || '{}' };
  }

  app.get('/api/status', limiter(limits.read), (_req, res) => {
    const ready = Boolean(apiKey);
    res.json({ ready, provider: 'Google Gemini', model, message: `Node API ready · ${ready ? `Gemini configured (${model})` : 'Gemini not configured'}.` });
  });

  app.get('/api/locations', limiter(limits.read), async (req, res) => {
    const category = String(req.query.category || '');
    if (!Object.hasOwn(datasets, category)) return res.status(400).json({ error: 'Choose a supported collection category.' });
    try {
      const geo = await getDataset(datasets[category]);
      res.json({ category, locations: normalizeLocations(geo, category), source: 'NEA open location dataset via data.gov.sg', notice: 'Location listings may be outdated. Confirm the point accepts your item before travelling.' });
    } catch {
      res.status(503).json({ error: 'Could not load these collection locations right now. Try again later.' });
    }
  });

  app.post('/api/analyze', limiter(limits.analyze), photoJson, async (req, res) => {
    const { image, imageType, language } = req.body || {};
    if (!apiKey) return res.status(503).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY to the .env file and restart the server.' });
    if (typeof image !== 'string' || !image.length) return res.status(400).json({ error: 'No photo was received. Choose a photo and try again.' });
    if (image.length > 16 * 1024 * 1024) return res.status(413).json({ error: 'This photo is too large. Try a smaller photo.' });
    if (!['image/jpeg','image/png','image/webp'].includes(imageType)) return res.status(415).json({ error: 'Please use a JPG, PNG, or WebP photo.' });
    try {
      const result = await callGemini({
        contents: [{ parts: [{ text: analyzePrompt(catalog, isLanguage(language) ? language : 'en') }, { inline_data: { mime_type: imageType, data: image } }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: analyzeSchema(allowedIds), temperature: 0 },
      }, 90000);
      if (result.status) return res.status(result.status === 429 ? 429 : 502).json({ error: result.status === 429 ? 'Gemini is busy or the API limit was reached. Wait and try again.' : `Gemini could not analyse this photo (${result.status}).` });
      res.json(parseDetections(result.text, allowedIds));
    } catch (error) {
      res.status(error.name === 'TimeoutError' ? 504 : 502).json({ error: error.name === 'TimeoutError' ? 'Gemini took too long to respond. Try again with a clearer photo.' : 'Gemini returned an unreadable response or could not be reached.' });
    }
  });

  app.post('/api/text-analyze', limiter(limits.chat), smallJson, async (req, res) => {
    if (!apiKey) return res.status(503).json({ error: 'Hosted chat needs GEMINI_API_KEY in the local .env file.' });
    const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-12) : [];
    const contents = messages.filter(row => ['user','model'].includes(row?.role) && typeof row.text === 'string').map(row => ({ role:row.role, parts:[{text:row.text.slice(0,500)}] }));
    if (!contents.length || contents.at(-1).role !== 'user') return res.status(400).json({ error: 'Type a question or describe an item first.' });
    if (contents[0].role === 'model') contents.shift();
    const language = languageName(req.body?.language);
    const instructions = `You are BinSense, a concise assistant for Singapore household waste sorting. Reply in ${language}. Use the curated principles: accepted clean dry paper, plastic, metal and glass go in blue bins; clean plastic bags, magazines, empty/rinsed shampoo bottles, clean foil and accepted egg trays can be recycled; egg-tray material must be checked; dirty foil, food-stained paper, tissue, Styrofoam and ceramic/Pyrex cookware go in general waste; aerosol cans must be completely empty before recycling; batteries, bulbs and electronics need dedicated e-waste collection; compost food only with a suitable home setup; clean dry reusable clothing may go to textile collection and acceptance differs; the 10-cent scheme applies only to eligible marked drink containers, never food cans. Do not invent locations, rules, or rewards. If the answer depends on unclear material or condition, ask. Catalog IDs: ${JSON.stringify([...allowedIds])}`;
    const schema = { type:'OBJECT', properties:{ reply:{type:'STRING'}, item_ids:{type:'ARRAY',items:{type:'STRING',enum:[...allowedIds]}} }, required:['reply','item_ids'], propertyOrdering:['reply','item_ids'] };
    try {
      const result = await callGemini({ systemInstruction:{parts:[{text:instructions}]}, contents, generationConfig:{responseMimeType:'application/json',responseSchema:schema,temperature:.3} }, 45000);
      if (result.status) return res.status(result.status === 429 ? 429 : 502).json({error:`Gemini could not answer right now (${result.status}).`});
      const parsed = JSON.parse(result.text);
      res.json({reply:String(parsed.reply||'').slice(0,1800),item_ids:[...new Set((parsed.item_ids||[]).filter(id=>allowedIds.has(id)))]});
    } catch { res.status(502).json({error:'Gemini returned an unreadable answer or could not be reached.'}); }
  });

  if (correctionStore) {
    app.post('/api/corrections', limiter(limits.correction), smallJson, asyncRoute(async (req, res) => {
      const result = validateCorrection(req.body, allowedIds);
      if (!result.ok) return res.status(400).json({ error: result.error });
      await correctionStore.add({ id: randomUUID(), createdAt: Date.now(), model, ...result.correction });
      res.status(201).json({ ok: true });
    }));
  }

  if (reportStore && photoDir) {
    app.get('/api/reports', limiter(limits.read), (_req, res) => {
      res.json({ reports: publicReports(reportStore.list()) });
    });
    app.post('/api/reports', limiter(limits.reportWrite), reportJson, asyncRoute(async (req, res) => {
      const result = validateReport(req.body);
      if (!result.ok) return res.status(400).json({ error: result.error });
      const id = randomUUID();
      const photoPath = path.join(photoDir, `${id}.jpg`);
      if (result.photo) {
        await mkdir(photoDir, { recursive: true });
        await writeFile(photoPath, result.photo);
      }
      const record = { id, createdAt: Date.now(), hasPhoto: Boolean(result.photo), ...result.report };
      try {
        await reportStore.add(record);
      } catch (error) {
        // Don't leave an orphaned photo that no report points to.
        if (result.photo) await rm(photoPath, { force: true });
        throw error;
      }
      res.status(201).json({ report: publicReports([record])[0] });
    }));
    app.get('/api/reports/:id/photo', limiter(limits.read), (req, res) => {
      // The ID becomes part of a file path, so it must be a UUID and nothing
      // else; otherwise "../../.env" style IDs could read other files.
      if (!isReportId(req.params.id)) return res.status(404).end();
      res.type('image/jpeg').sendFile(path.join(photoDir, `${req.params.id}.jpg`), err => { if (err && !res.headersSent) res.status(404).end(); });
    });
  }

  // Any other /api path is a 404 in JSON, not the HTML app shell.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));
  // Malformed or oversized JSON bodies get a clear JSON error.
  app.use((error, _req, res, next) => {
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON.' });
    console.error(error);
    if (res.headersSent) return next(error);
    res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
  });

  if (distDir) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }
  return app;
}
