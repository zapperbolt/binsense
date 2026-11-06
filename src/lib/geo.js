// Great-circle distance between two {lat, lng} points (haversine formula), in km.
export function distanceKm(a, b) {
  const r = 6371, rad = v => v * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(q));
}
