import { readFileSync } from 'node:fs';

// Visual hints that help Gemini tell similar items apart. These are prompt
// details, so they live on the server. Everything else about an item
// (name, category, advice) comes from src/data/items.json, the single source
// of truth shared with the React app.
export const visualClues = {
  'plastic-bottle': 'clear or coloured plastic beverage bottle',
  'aluminium-can': 'metal beverage can',
  'glass-jar': 'glass bottle or food jar',
  'cardboard': 'cardboard or paper box; heavy food stains mean food-stained-paper',
  'newspaper': 'newspaper, newsprint, or clean dry newsprint paper',
  'metal-food-can': 'steel or aluminium food tin or can, including canned beans',
  'plastic-container': 'rigid plastic food tub, tray, or takeaway container; distinguish foam',
  'milk-carton': 'beverage carton such as a milk or juice carton',
  'banana-peel': 'recognisable fruit or vegetable scraps',
  'food-stained-paper': 'paper food packaging with visible food or grease contamination',
  'tissue': 'tissue or toilet paper',
  'styrofoam': 'expanded polystyrene foam takeaway container',
  'battery': 'small cylindrical household battery',
  'phone': 'mobile phone or smartphone',
  'clothing': 'recognisable clothes, shoes, or reusable textile',
  'plastic-bag': 'clean plastic shopping bag or reusable carrier bag',
  'shampoo-bottle': 'plastic shampoo, bodywash, cleanser, detergent or soap bottle',
  'magazine': 'printed magazine, brochure, flyer or clean paper booklet',
  'egg-tray': 'egg tray; material may be paper, plastic or foam',
  'aluminium-foil': 'clean aluminium foil sheet or food tray',
  'aerosol-can': 'spray or aerosol can; image cannot establish whether it is empty',
  'light-bulb': 'light bulb, lamp or fluorescent tube',
  'laptop': 'laptop computer or tablet computer',
  'power-bank': 'portable rechargeable battery or power bank',
  'ceramic-cookware': 'ceramic, porcelain, Pyrex or heat-resistant cookware',
};

// Joins items.json with the visual clues. Throws at startup if the two lists
// drift apart, so a missing entry is caught immediately instead of silently
// producing an item Gemini can never return (or one the UI can't show).
export function buildCatalog(items, clues = visualClues) {
  const itemIds = new Set(items.map(item => item.id));
  const missingClues = [...itemIds].filter(id => !clues[id]);
  const unknownClues = Object.keys(clues).filter(id => !itemIds.has(id));
  if (missingClues.length || unknownClues.length) {
    throw new Error(`Catalog mismatch. Missing visual clues: [${missingClues.join(', ')}]. Clues for unknown items: [${unknownClues.join(', ')}].`);
  }
  return items.map(item => ({ id: item.id, name: item.name, 'visual clues': clues[item.id] }));
}

const items = JSON.parse(readFileSync(new URL('../src/data/items.json', import.meta.url), 'utf8'));
export const itemsById = new Map(items.map(item => [item.id, item]));
export const catalog = buildCatalog(items);
export const allowedIds = new Set(catalog.map(item => item.id));
