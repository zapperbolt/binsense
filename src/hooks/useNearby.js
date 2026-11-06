import { useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { distanceKm } from '../lib/geo.js';

export function useGeolocation() {
  const [position, setPosition] = useState(null);
  const [geoKey, setGeoKey] = useState('');
  function locate() {
    if (!navigator.geolocation) { setGeoKey('nearby.noGeo'); return; }
    setGeoKey('nearby.locating');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setPosition({ lat: coords.latitude, lng: coords.longitude }); setGeoKey('nearby.located'); },
      error => setGeoKey(error.code === 1 ? 'nearby.denied' : 'nearby.geoFailed'),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  }
  return { position, geoKey, locate };
}

export function useNearby(position) {
  const [locations, setLocations] = useState([]);
  const [category, setCategory] = useState('recycling');
  const [stateKey, setStateKey] = useState('nearby.choose');
  const request = useRef(null);

  async function load(next = category) {
    setCategory(next);
    // Cancel any request still in flight so a slow, older response can't
    // overwrite the category the user picked most recently.
    request.current?.abort();
    if (next === 'beverage') { setLocations([]); setStateKey('nearby.beverage'); return; }
    const controller = new AbortController();
    request.current = controller;
    setLocations([]); setStateKey('nearby.loading');
    try {
      const res = await api(`/api/locations?category=${encodeURIComponent(next)}`, { signal: controller.signal });
      // A newer request has started since this one: its result wins.
      if (request.current !== controller) return;
      if (!res.ok) { setStateKey('nearby.failed'); return; }
      setLocations(res.data?.locations || []); setStateKey('nearby.loaded');
    } catch (error) {
      if (error.name !== 'AbortError') setStateKey('nearby.failed');
    }
  }

  const sorted = useMemo(() => locations
    .map(loc => ({ ...loc, distance: position ? distanceKm(position, loc) : null }))
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
    .slice(0, 120), [locations, position]);

  return { locations: sorted, category, stateKey, load };
}
