import { describe, expect, it } from 'vitest';
import { distanceKm } from '../src/lib/geo.js';

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    expect(distanceKm({ lat: 1.35, lng: 103.82 }, { lat: 1.35, lng: 103.82 })).toBe(0);
  });
  it('matches a known distance (Changi Airport to Jurong East ≈ 32 km)', () => {
    const d = distanceKm({ lat: 1.3644, lng: 103.9915 }, { lat: 1.3329, lng: 103.7436 });
    expect(d).toBeGreaterThan(27);
    expect(d).toBeLessThan(29);
  });
});
