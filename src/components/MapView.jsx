import { useEffect } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';

const SINGAPORE = [1.3521, 103.8198];

// Moves the map only when the set of points or the focus really changes.
// Parents rebuild the points array on every render (e.g. each map click), so
// depending on the array itself would make the map jump back constantly.
function Viewport({ points, focus }) {
  const map = useMap();
  const pointsKey = points.map(p => p.id).join('|');
  const focusKey = focus ? `${focus.lat},${focus.lng}` : '';
  useEffect(() => {
    if (focus) map.setView([focus.lat, focus.lng], 15);
    else if (points.length) map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [24, 24], maxZoom: 14 });
  }, [map, pointsKey, focusKey]);
  return null;
}

function ClickHandler({ onClick }) {
  useMapEvents({ click: e => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

// Shared Leaflet map. points: [{ id, lat, lng, color, popup }]. Optional
// `you` marker for the user's position and `pin` for a location being picked.
export function MapView({ points, you, youLabel, pin, pinLabel, onMapClick, focus }) {
  return <MapContainer className="app-map" center={SINGAPORE} zoom={11} scrollWheelZoom>
    <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Viewport points={points} focus={focus} />
    {onMapClick && <ClickHandler onClick={onMapClick} />}
    {points.map(p => <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={7} pathOptions={{ color: '#173b2b', fillColor: p.color || '#b9f36b', fillOpacity: 0.9 }}><Popup>{p.popup}</Popup></CircleMarker>)}
    {you && <CircleMarker center={[you.lat, you.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#315fdb', fillOpacity: 1 }}><Popup>{youLabel}</Popup></CircleMarker>}
    {pin && <CircleMarker center={[pin.lat, pin.lng]} radius={10} pathOptions={{ color: '#c2412d', weight: 3, fillColor: '#fff', fillOpacity: 1 }}><Popup>{pinLabel}</Popup></CircleMarker>}
  </MapContainer>;
}
