// Terrain-masked LOS: a clear path over flat terrain is occluded once a tall ridge
// is placed between the endpoints, and the body curvature blocks an over-horizon
// path on its own. Pure. (STK_PARITY_SPEC §4.12.)

import { describe, it, expect } from 'vitest';
import { terrainMaskedLos, FLAT_DEM, type Dem, type Vec3 } from './index.ts';

const R = 6371;

// Two points at 200 km altitude, 0.1 rad of longitude apart, in the equatorial plane.
const A: Vec3 = { x: (R + 200) * Math.cos(0), y: (R + 200) * Math.sin(0), z: 0 };
const B: Vec3 = { x: (R + 200) * Math.cos(0.1), y: (R + 200) * Math.sin(0.1), z: 0 };

describe('terrainMaskedLos', () => {
  it('is clear between two elevated points over flat terrain', () => {
    expect(terrainMaskedLos(A, B, FLAT_DEM, R)).toBe(true);
  });

  it('is blocked once a tall ridge rises between the endpoints', () => {
    // A 300 km ridge near the chord midpoint (lon ~ 0.05) rises above the LOS.
    const ridge: Dem = { heightAt: (lon) => (Math.abs(lon - 0.05) < 0.02 ? 300_000 : 0) };
    expect(terrainMaskedLos(A, B, ridge, R)).toBe(false);
  });

  it('a low ridge below the LOS does not block it', () => {
    const lowRidge: Dem = { heightAt: (lon) => (Math.abs(lon - 0.05) < 0.02 ? 50_000 : 0) };
    expect(terrainMaskedLos(A, B, lowRidge, R)).toBe(true);
  });

  it('the body curvature blocks an over-horizon surface-to-surface path', () => {
    const s1: Vec3 = { x: R, y: 0, z: 0 };
    const s2: Vec3 = { x: R * Math.cos(2.5), y: R * Math.sin(2.5), z: 0 }; // far around the limb
    expect(terrainMaskedLos(s1, s2, FLAT_DEM, R)).toBe(false);
  });
});
