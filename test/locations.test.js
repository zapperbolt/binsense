import { describe, expect, it } from 'vitest';
import { clean, normalizeLocations } from '../server/locations.js';

const point = (lng, lat, properties = {}) => ({ geometry: { type: 'Point', coordinates: [lng, lat] }, properties });

describe('clean', () => {
  it('strips HTML tags and entities', () => {
    expect(clean('<b>Blk 1</b>&nbsp;Main&amp;Co  St')).toBe('Blk 1 Main&Co St');
  });
  it('handles null', () => { expect(clean(null)).toBe(''); });
});

describe('normalizeLocations', () => {
  it('keeps valid Singapore points', () => {
    const [loc] = normalizeLocations({ features: [point(103.85, 1.30, { NAME: 'Bin A', OBJECTID: 7, FULLADDRESS: '1 Road' })] }, 'recycling');
    expect(loc).toMatchObject({ id: 'recycling-7', name: 'Bin A', address: '1 Road', lat: 1.30, lng: 103.85 });
  });
  it('drops points outside Singapore, non-points and bad coordinates', () => {
    const geo = { features: [
      point(0, 0),
      { geometry: { type: 'Polygon', coordinates: [] } },
      point('abc', 1.3),
    ] };
    expect(normalizeLocations(geo, 'recycling')).toEqual([]);
  });
  it('drops staff-only points', () => {
    expect(normalizeLocations({ features: [point(103.85, 1.3, { ACCESSRESTRICTION: 'Staff only' })] }, 'ewaste')).toEqual([]);
  });
  it('keeps only clothing-related textile points', () => {
    const geo = { features: [point(103.85, 1.3, { NAME: 'Clothing bin' }), point(103.85, 1.3, { NAME: 'Paper bank' })] };
    expect(normalizeLocations(geo, 'textile').map(l => l.name)).toEqual(['Clothing bin']);
  });
  it('recognises "clothes" as a textile point', () => {
    expect(normalizeLocations({ features: [point(103.85, 1.3, { NAME: 'Used clothes bin' })] }, 'textile')).toHaveLength(1);
  });
  it('tolerates missing input', () => { expect(normalizeLocations(undefined, 'recycling')).toEqual([]); });
});
