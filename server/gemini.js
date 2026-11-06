// Prompt, response schema and response validation for photo analysis.
// Kept separate from the Express route so the parsing rules can be unit-tested
// without calling the real Gemini API.

export const MAX_DETECTIONS = 12;
const CONFIDENCES = ['high', 'medium'];
// What Gemini can see about an item's state. An enum (not free text) so the
// browser can show its own wording, in any language, and test every case.
export const CONDITIONS = ['looks_clean', 'not_empty', 'food_residue', 'cannot_tell'];
export const LANGUAGES = { en: 'English', zh: 'Simplified Chinese', ms: 'Malay', ta: 'Tamil' };
// Object.hasOwn, not LANGUAGES[code] alone: 'toString' would otherwise match.
export const isLanguage = code => typeof code === 'string' && Object.hasOwn(LANGUAGES, code);
export const languageName = code => (isLanguage(code) ? LANGUAGES[code] : LANGUAGES.en);

export function analyzePrompt(catalog, language = 'en') {
  return [
    'Inspect the photo for distinct household waste items sortable with a Singapore guide.',
    `Return up to ${MAX_DETECTIONS} clearly visible items. List each physical object separately, even if two objects share a catalog ID.`,
    'Select only catalog IDs. Use visible evidence; do not infer hidden material, cleanliness, or contents.',
    'If an item shows visible food or grease contamination, choose the contaminated catalog option where one exists.',
    'For each item give:',
    '- label: at most 6 words that let a person find that exact object in the photo, e.g. "clear bottle, left side".',
    `  Write the label in ${languageName(language)}.`,
    '- box_2d: its bounding box as [ymin, xmin, ymax, xmax], each normalised to 0-1000.',
    '- condition: "not_empty" if liquid or contents are visibly inside, "food_residue" if food or grease is visibly on it,',
    '  "looks_clean" if it visibly looks empty and clean, otherwise "cannot_tell". Never guess what you cannot see.',
    'Do not give disposal advice. If no item is recognizable, return an empty items array and a short description.',
    `Catalog: ${JSON.stringify(catalog)}`,
  ].join('\n');
}

export function analyzeSchema(allowedIds) {
  const properties = {
    item_id: { type: 'STRING', enum: [...allowedIds] },
    label: { type: 'STRING' },
    confidence: { type: 'STRING', enum: CONFIDENCES },
    box_2d: { type: 'ARRAY', items: { type: 'INTEGER' } },
    condition: { type: 'STRING', enum: CONDITIONS },
  };
  const order = ['item_id', 'label', 'confidence', 'box_2d', 'condition'];
  return {
    type: 'OBJECT',
    properties: {
      items: { type: 'ARRAY', items: { type: 'OBJECT', properties, required: order, propertyOrdering: order } },
      description: { type: 'STRING' },
    },
    required: ['items', 'description'],
    propertyOrdering: ['items', 'description'],
  };
}

// Converts Gemini's [ymin, xmin, ymax, xmax] (0-1000) into fractions of the
// image size (0-1), which the browser can draw at any display size.
// Returns null for anything malformed, so one bad box never breaks the list.
export function toBox(raw) {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const nums = raw.map(Number);
  if (!nums.every(Number.isFinite)) return null;
  const [ymin, xmin, ymax, xmax] = nums.map(n => Math.min(1000, Math.max(0, n)) / 1000);
  if (ymax <= ymin || xmax <= xmin) return null;
  return { top: ymin, left: xmin, bottom: ymax, right: xmax };
}

const cleanLabel = value => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);

// Validates Gemini's JSON text. Throws SyntaxError if the text is not JSON;
// silently drops rows that are not usable (unknown ID, bad confidence).
export function parseDetections(text, allowedIds) {
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed?.items) ? parsed.items : [];
  const items = rows
    .filter(row => row && allowedIds.has(row.item_id) && CONFIDENCES.includes(row.confidence))
    .slice(0, MAX_DETECTIONS)
    .map(row => ({
      item_id: row.item_id,
      label: cleanLabel(row.label),
      confidence: row.confidence,
      box: toBox(row.box_2d),
      condition: CONDITIONS.includes(row.condition) ? row.condition : 'cannot_tell',
    }));
  return { items, description: String(parsed?.description ?? '').trim().slice(0, 240) };
}
