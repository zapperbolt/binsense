// Turns NEA GeoJSON from data.gov.sg into the small location objects the UI needs.
export const datasets = {
  recycling: 'd_4dde14826642f49eefff48b7832b90db',
  ewaste: 'd_db40d004afeb5a7f0f555fdcc34934cc',
  textile: 'd_7e1f0da76a744c85e3d3ecc76642dcb5',
};

export const clean = value => String(value ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim();

// Rough bounding box for Singapore; drops points with broken coordinates.
const inSingapore = (lat, lng) => lat >= 1.15 && lat <= 1.48 && lng >= 103.55 && lng <= 104.1;

export function normalizeLocations(geo, category) {
  return (geo?.features || []).flatMap((feature, index) => {
    const coords = feature.geometry?.coordinates || [];
    if (feature.geometry?.type !== 'Point' || coords.length < 2) return [];
    const [lng, lat] = coords.map(Number);
    const p = feature.properties || {};
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inSingapore(lat, lng)) return [];
    const name = clean(p.NAME || p.Name || 'Collection point');
    let address = clean(p.FULLADDRESS || [p.ADDRESSBLOCKHOUSENUMBER, p.ADDRESSSTREETNAME, p.ADDRESSBUILDINGNAME, p.ADDRESSPOSTALCODE].filter(Boolean).join(' '));
    const accepted = clean(p.ACCEPTEDITEMS || p.DESCRIPTION || (category === 'recycling' ? 'Paper, plastic, metal and glass recyclables' : 'Check accepted items at this point'));
    if (!address) address = clean(p.DESCRIPTION || 'Address details not provided');
    if (category === 'textile' && !/cloth|textile|garment|shoe/i.test(`${name} ${accepted} ${p.DESCRIPTION || ''}`)) return [];
    if (/restricted|staff only|staff-only/i.test(String(p.ACCESSRESTRICTION || ''))) return [];
    return [{ id: `${category}-${p.OBJECTID ?? index}`, category, name: name.slice(0, 140), address: address.slice(0, 240), accepted: accepted.slice(0, 180), lat, lng }];
  });
}
