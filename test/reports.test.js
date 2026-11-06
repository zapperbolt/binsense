import { describe, expect, it } from 'vitest';
import { decodePhoto, isReportId, publicReports, validateReport } from '../server/reports.js';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64');
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');
const valid = (over = {}) => ({ issue: 'overflowing', binType: 'recycling', lat: 1.35211234, lng: 103.81981234, note: '  bins   full ', ...over });

describe('validateReport', () => {
  it('accepts a valid report, trims the note and rounds the location', () => {
    const result = validateReport(valid());
    expect(result).toMatchObject({ ok: true, photo: null, report: { issue: 'overflowing', binType: 'recycling', lat: 1.3521, lng: 103.8198, note: 'bins full' } });
  });
  it('defaults binType to unknown', () => {
    expect(validateReport(valid({ binType: undefined })).report.binType).toBe('unknown');
  });
  it.each([
    ['unknown issue', { issue: 'smelly' }],
    ['inherited key as issue', { issue: 'toString' }],
    ['bad bin type', { binType: 'rocket' }],
    ['outside Singapore', { lat: 51.5, lng: -0.12 }],
    ['missing location', { lat: undefined }],
    ['non-text note', { note: { x: 1 } }],
    ['PNG instead of JPEG', { photo: png }],
    ['not base64', { photo: '<script>' }],
  ])('rejects %s', (_name, over) => {
    expect(validateReport(valid(over)).ok).toBe(false);
  });
  it('rejects a missing body', () => { expect(validateReport(undefined).ok).toBe(false); });
  it('caps the note length', () => {
    expect(validateReport(valid({ note: 'x'.repeat(500) })).report.note).toHaveLength(200);
  });
  it('accepts a JPEG photo', () => {
    expect(validateReport(valid({ photo: jpeg })).photo).toBeInstanceOf(Buffer);
  });
});

describe('decodePhoto', () => {
  it('treats empty as no photo', () => { expect(decodePhoto('')).toEqual({ ok: true, bytes: null }); });
  it('rejects photos over the size limit', () => {
    const big = Buffer.alloc(2 * 1024 * 1024, 0xff).toString('base64');
    expect(decodePhoto(big)).toEqual({ ok: false, error: 'Photo is too large.' });
  });
});

describe('isReportId', () => {
  it('accepts UUIDs only', () => {
    expect(isReportId('0b6c2f1e-3d4a-4b5c-8d9e-0f1a2b3c4d5e')).toBe(true);
    for (const bad of ['../../.env', '..%2F.env', '', 'abc', undefined]) expect(isReportId(bad)).toBe(false);
  });
});

describe('publicReports', () => {
  const day = 24 * 60 * 60 * 1000, now = 100 * day;
  const rec = (id, age, hasPhoto = false) => ({ id, createdAt: now - age, hasPhoto, issue: 'damaged', binType: 'general', lat: 1.3, lng: 103.8, note: '', secret: 'x' });
  it('returns only the last 30 days, newest first, without internal fields', () => {
    const out = publicReports([rec('old', 31 * day), rec('a', 2 * day), rec('b', 1 * day, true)], now);
    expect(out.map(r => r.id)).toEqual(['b', 'a']);
    expect(out[0].photoUrl).toBe('/api/reports/b/photo');
    expect(out[1].photoUrl).toBeNull();
    expect(out[0]).not.toHaveProperty('secret');
  });
});
