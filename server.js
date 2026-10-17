import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../.env') });

const app = express();
const port = Number(process.env.BINSENSE_PORT || 5051);
const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const apiKey = process.env.GEMINI_API_KEY || '';
const datasets = { recycling: 'd_4dde14826642f49eefff48b7832b90db', ewaste: 'd_db40d004afeb5a7f0f555fdcc34934cc', textile: 'd_7e1f0da76a744c85e3d3ecc76642dcb5' };
const cache = new Map();
const cacheMs = 6 * 60 * 60 * 1000;
const catalog = [
  ['plastic-bottle','Plastic drink bottle','clear or coloured plastic beverage bottle'],
  ['aluminium-can','Aluminium drink can','metal beverage can'],
  ['glass-jar','Glass bottle or jar','glass bottle or food jar'],
  ['cardboard','Clean cardboard box','cardboard or paper box; heavy food stains mean food-stained-paper'],
  ['newspaper','Newspaper','newspaper, newsprint, or clean dry newsprint paper'],
  ['metal-food-can','Metal food can','steel or aluminium food tin or can, including canned beans'],
  ['plastic-container','Plastic food container','rigid plastic food tub, tray, or takeaway container; distinguish foam'],
  ['milk-carton','Drink carton','beverage carton such as a milk or juice carton'],
  ['banana-peel','Fruit or vegetable scraps','recognisable fruit or vegetable scraps'],
  ['food-stained-paper','Food-stained paper packaging','paper food packaging with visible food or grease contamination'],
  ['tissue','Tissue paper','tissue or toilet paper'],
  ['styrofoam','Styrofoam food container','expanded polystyrene foam takeaway container'],
  ['battery','AA / AAA battery','small cylindrical household battery'],
  ['phone','Old mobile phone','mobile phone or smartphone'],
  ['clothing','Clothing or reusable textile','recognisable clothes, shoes, or reusable textile'],
  ['plastic-bag','Clean plastic bag','clean plastic shopping bag or reusable carrier bag'],
  ['shampoo-bottle','Shampoo or detergent bottle','plastic shampoo, bodywash, cleanser, detergent or soap bottle'],
  ['magazine','Magazine or brochure','printed magazine, brochure, flyer or clean paper booklet'],
  ['egg-tray','Egg tray','egg tray; material may be paper, plastic or foam'],
  ['aluminium-foil','Clean aluminium foil or tray','clean aluminium foil sheet or food tray'],
  ['aerosol-can','Empty aerosol can','spray or aerosol can; image cannot establish whether it is empty'],
  ['light-bulb','Light bulb or fluorescent tube','light bulb, lamp or fluorescent tube'],
  ['laptop','Laptop or tablet','laptop computer or tablet computer'],
  ['power-bank','Power bank','portable rechargeable battery or power bank'],
  ['ceramic-cookware','Ceramic or Pyrex cookware','ceramic, porcelain, Pyrex or heat-resistant cookware'],
].map(([id,name,clues]) => ({ id, name, 'visual clues': clues }));
const allowedIds = new Set(catalog.map(item => item.id));

app.disable('x-powered-by');
app.use(express.json({ limit: '18mb' }));
app.get('/api/status', (_req, res) => {
  const ready = Boolean(apiKey);
  res.json({ ready, provider: 'Google Gemini', model, message: `Node API ready · ${ready ? `Gemini configured (${model})` : 'Gemini not configured'} · MobileNet runs locally in this browser.` });
});

async function getDataset(datasetId) {
  const cached = cache.get(datasetId);
  if (cached && Date.now() - cached.time < cacheMs) return cached.data;
  const ticketResponse = await fetch(`https://api-open.data.gov.sg/v1/public/api/datasets/${datasetId}/poll-download`, { signal: AbortSignal.timeout(30000) });
  if (!ticketResponse.ok) throw new Error('Dataset ticket unavailable');
  const ticket = await ticketResponse.json();
  const url = ticket?.data?.url;
  if (ticket.code !== 0 || !url) throw new Error('Dataset download unavailable');
  const geoResponse = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!geoResponse.ok) throw new Error('Dataset download unavailable');
  const geojson = await geoResponse.json();
  cache.set(datasetId, { time: Date.now(), data: geojson });
  return geojson;
}
const clean = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
app.get('/api/locations', async (req, res) => {
  const category = String(req.query.category || '');
  if (!datasets[category]) return res.status(400).json({ error: 'Choose a supported collection category.' });
  try {
    const geo = await getDataset(datasets[category]);
    const locations = (geo.features || []).flatMap((feature, index) => {
      const coords = feature.geometry?.coordinates || [];
      if (feature.geometry?.type !== 'Point' || coords.length < 2) return [];
      const [lng, lat] = coords.map(Number); const p = feature.properties || {};
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 1.15 || lat > 1.48 || lng < 103.55 || lng > 104.1) return [];
      const name = clean(p.NAME || p.Name || 'Collection point');
      let address = clean(p.FULLADDRESS || [p.ADDRESSBLOCKHOUSENUMBER,p.ADDRESSSTREETNAME,p.ADDRESSBUILDINGNAME,p.ADDRESSPOSTALCODE].filter(Boolean).join(' '));
      let accepted = clean(p.ACCEPTEDITEMS || p.DESCRIPTION || (category === 'recycling' ? 'Paper, plastic, metal and glass recyclables' : 'Check accepted items at this point'));
      if (!address) address = clean(p.DESCRIPTION || 'Address details not provided');
      if (category === 'textile' && !/clothing|textile|garment|shoes/i.test(`${name} ${accepted} ${p.DESCRIPTION || ''}`)) return [];
      if (/restricted|staff only|staff-only/i.test(String(p.ACCESSRESTRICTION || ''))) return [];
      return [{ id: `${category}-${p.OBJECTID ?? index}`, category, name: name.slice(0,140), address: address.slice(0,240), accepted: accepted.slice(0,180), lat, lng }];
    });
    res.json({ category, locations, source: 'NEA open location dataset via data.gov.sg', notice: 'Location listings may be outdated. Confirm the point accepts your item before travelling.' });
  } catch {
    res.status(503).json({ error: 'Could not load these collection locations right now. Try again later.' });
  }
});

app.post('/api/analyze', async (req, res) => {
  const { image, imageType } = req.body || {};
  if (!apiKey) return res.status(503).json({ error: 'Hosted Gemini is not configured. Use on-device MobileNet or add GEMINI_API_KEY to the local .env file.' });
  if (typeof image !== 'string' || !image.length || image.length > 16 * 1024 * 1024) return res.status(413).json({ error: 'This photo is empty or too large. Try a smaller photo.' });
  if (!['image/jpeg','image/png','image/webp'].includes(imageType)) return res.status(415).json({ error: 'Please use a JPG, PNG, or WebP photo.' });
  const prompt = `Inspect the photo for distinct household waste items sortable with a Singapore guide. Return up to 12 clearly visible items. Select only catalog IDs. Use visible evidence; do not infer hidden material, cleanliness, or contents. Do not give disposal advice. If no item is recognizable, return an empty items array and a short description. Catalog: ${JSON.stringify(catalog)}`;
  const properties = { item_id: { type: 'STRING', enum: [...allowedIds] }, confidence: { type: 'STRING', enum: ['high','medium'] } };
  const schema = { type: 'OBJECT', properties: { items: { type: 'ARRAY', items: { type: 'OBJECT', properties, required: ['item_id','confidence'], propertyOrdering: ['item_id','confidence'] } }, description: { type: 'STRING' } }, required: ['items','description'], propertyOrdering: ['items','description'] };
  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type':'application/json', 'x-goog-api-key':apiKey }, signal: AbortSignal.timeout(90000),
      body: JSON.stringify({ contents:[{parts:[{text:prompt},{inline_data:{mime_type:imageType,data:image}}]}], generationConfig:{responseMimeType:'application/json',responseSchema:schema,temperature:0} }),
    });
    if (!upstream.ok) return res.status(upstream.status === 429 ? 429 : 502).json({ error: upstream.status === 429 ? 'Gemini is busy or the API limit was reached. Wait and try again.' : `Gemini could not analyse this photo (${upstream.status}).` });
    const payload = await upstream.json();
    const text = payload.candidates?.[0]?.content?.parts?.find(part => part.text)?.text || '{}';
    const parsed = JSON.parse(text);
    const valid = (parsed.items || []).slice(0,12).filter(row => allowedIds.has(row.item_id) && ['high','medium'].includes(row.confidence));
    res.json({ items: valid, description: String(parsed.description || '').slice(0,240) });
  } catch (error) {
    res.status(error.name === 'TimeoutError' ? 504 : 502).json({ error: error.name === 'TimeoutError' ? 'Gemini took too long to respond. Try again with a clearer photo.' : 'Gemini returned an unreadable response or could not be reached.' });
  }
});

app.post('/api/text-analyze', async (req, res) => {
  if (!apiKey) return res.status(503).json({ error: 'Hosted chat needs GEMINI_API_KEY in the local .env file.' });
  const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-12) : [];
  const contents = messages.filter(row => ['user','model'].includes(row.role) && typeof row.text === 'string').map(row => ({ role:row.role, parts:[{text:row.text.slice(0,500)}] }));
  if (!contents.length || contents.at(-1).role !== 'user') return res.status(400).json({ error: 'Type a question or describe an item first.' });
  if (contents[0].role === 'model') contents.shift();
  const instructions = `You are BinSense, a concise assistant for Singapore household waste sorting. Use the curated principles: accepted clean dry paper, plastic, metal and glass go in blue bins; clean plastic bags, magazines, empty/rinsed shampoo bottles, clean foil and accepted egg trays can be recycled; egg-tray material must be checked; dirty foil, food-stained paper, tissue, Styrofoam and ceramic/Pyrex cookware go in general waste; aerosol cans must be completely empty before recycling; batteries, bulbs and electronics need dedicated e-waste collection; compost food only with a suitable home setup; clean dry reusable clothing may go to textile collection and acceptance differs; the 10-cent scheme applies only to eligible marked drink containers, never food cans. Do not invent locations, rules, or rewards. If the answer depends on unclear material or condition, ask. Catalog IDs: ${JSON.stringify([...allowedIds])}`;
  const schema = { type:'OBJECT', properties:{ reply:{type:'STRING'}, item_ids:{type:'ARRAY',items:{type:'STRING',enum:[...allowedIds]}} }, required:['reply','item_ids'], propertyOrdering:['reply','item_ids'] };
  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method:'POST', headers:{'Content-Type':'application/json','x-goog-api-key':apiKey}, signal:AbortSignal.timeout(45000), body:JSON.stringify({systemInstruction:{parts:[{text:instructions}]},contents,generationConfig:{responseMimeType:'application/json',responseSchema:schema,temperature:.3}}) });
    if (!upstream.ok) return res.status(upstream.status === 429 ? 429 : 502).json({error:`Gemini could not answer right now (${upstream.status}).`});
    const payload=await upstream.json(); const text=payload.candidates?.[0]?.content?.parts?.find(part=>part.text)?.text||'{}'; const result=JSON.parse(text);
    res.json({reply:String(result.reply||'').slice(0,1800),item_ids:[...new Set((result.item_ids||[]).filter(id=>allowedIds.has(id)))]});
  } catch { res.status(502).json({error:'Gemini returned an unreadable answer or could not be reached.'}); }
});

app.use(express.static(path.join(here, 'dist')));
app.get('*', (_req,res) => res.sendFile(path.join(here,'dist','index.html')));
app.listen(port, '127.0.0.1', () => console.log(`BinSense Node API available on http://127.0.0.1:${port}`));
