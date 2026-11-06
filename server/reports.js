// Validation for community bin-problem reports. Pure functions, so every rule
// is unit-tested; the route only wires them to storage.

export const ISSUES = ['overflowing', 'contaminated', 'damaged', 'missing', 'other'];
export const BIN_TYPES = ['recycling', 'ewaste', 'textile', 'general', 'unknown'];
export const MAX_NOTE = 200;
export const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
export const REPORT_DAYS = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const isReportId = id => typeof id === 'string' && UUID.test(id);
const inSingapore = (lat, lng) => lat >= 1.15 && lat <= 1.48 && lng >= 103.55 && lng <= 104.1;

// Decodes an optional base64 JPEG. Checks the real file signature (FF D8 FF)
// instead of trusting a file name or MIME type sent by the browser.
export function decodePhoto(photo) {
  if (photo == null || photo === '') return { ok: true, bytes: null };
  if (typeof photo !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo)) return { ok: false, error: 'Photo must be a base64 JPEG.' };
  const bytes = Buffer.from(photo, 'base64');
  if (bytes.length > MAX_PHOTO_BYTES) return { ok: false, error: 'Photo is too large.' };
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return { ok: false, error: 'Photo must be a JPEG.' };
  return { ok: true, bytes };
}

// Returns { ok: true, report } with only the fields we accept, or
// { ok: false, error } explaining what to fix.
export function validateReport(body) {
  const { issue, binType = 'unknown', note = '' } = body || {};
  const lat = Number(body?.lat), lng = Number(body?.lng);
  if (!ISSUES.includes(issue)) return { ok: false, error: 'Choose what is wrong with the bin.' };
  if (!BIN_TYPES.includes(binType)) return { ok: false, error: 'Choose a valid bin type.' };
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inSingapore(lat, lng)) return { ok: false, error: 'Pick a location in Singapore.' };
  if (typeof note !== 'string') return { ok: false, error: 'Note must be text.' };
  const photo = decodePhoto(body?.photo);
  if (!photo.ok) return photo;
  return {
    ok: true,
    photo: photo.bytes,
    report: {
      issue,
      binType,
      // ~11 m precision: enough to find the bin, and avoids publishing
      // a hyper-precise point if someone reports from their own doorstep.
      lat: Math.round(lat * 1e4) / 1e4,
      lng: Math.round(lng * 1e4) / 1e4,
      note: note.replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE),
    },
  };
}

// Public view: recent reports only, newest first, no internal fields.
export function publicReports(records, now = Date.now(), limit = 300) {
  const cutoff = now - REPORT_DAYS * 24 * 60 * 60 * 1000;
  return records
    .filter(r => r.createdAt >= cutoff)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map(({ id, issue, binType, lat, lng, note, createdAt, hasPhoto }) => ({
      id, issue, binType, lat, lng, note, createdAt,
      photoUrl: hasPhoto ? `/api/reports/${id}/photo` : null,
    }));
}
