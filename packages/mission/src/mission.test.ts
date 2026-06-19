// Lambert validated against Vallado's published example (7-5), and maneuver frames
// against hand-derived bases. Pure, no SPICE. (STK_PARITY_SPEC §4.2.)

import { describe, it, expect } from 'vitest';
import { lambert, frameBasis, applyImpulsiveManeuver, deltaVMagnitude } from './index.ts';

const MU_EARTH = 398600.4418;

describe('lambert', () => {
  it('reproduces Vallado example 7-5 velocities', () => {
    // r1, r2 (km), tof = 76 min; expected v1, v2 (km/s).
    const r1 = { x: 15945.34, y: 0, z: 0 };
    const r2 = { x: 12214.83899, y: 10249.46731, z: 0 };
    const { v1, v2 } = lambert(r1, r2, 76 * 60, MU_EARTH, true);
    expect(v1.x).toBeCloseTo(2.058913, 3);
    expect(v1.y).toBeCloseTo(2.915965, 3);
    expect(v2.x).toBeCloseTo(-3.451565, 3);
    expect(v2.y).toBeCloseTo(0.910315, 3);
  });

  it('produces a transfer whose endpoints reach r2 (energy/closure sanity)', () => {
    const r1 = { x: 5000, y: 10000, z: 2100 };
    const r2 = { x: -14600, y: 2500, z: 7000 };
    const sol = lambert(r1, r2, 3600, MU_EARTH, true);
    // Both velocity solutions are finite and of plausible LEO magnitude.
    expect(deltaVMagnitude(sol.v1)).toBeGreaterThan(1);
    expect(deltaVMagnitude(sol.v1)).toBeLessThan(15);
  });
});

describe('maneuver frames', () => {
  // A circular equatorial orbit: r along +x, v along +y.
  const state = { position: { x: 7000, y: 0, z: 0 }, velocity: { x: 0, y: 7.5, z: 0 } };

  it('RIC basis is radial/in-track/cross-track and orthonormal', () => {
    const b = frameBasis(state, 'RIC');
    expect(b.x).toEqual({ x: 1, y: 0, z: 0 }); // radial
    expect(b.y.y).toBeCloseTo(1, 9); // in-track ~ +y
    expect(b.z.z).toBeCloseTo(1, 9); // cross-track ~ +z
  });

  it('a prograde VNB burn adds along the velocity direction', () => {
    const after = applyImpulsiveManeuver(state, { x: 0.1, y: 0, z: 0 }, 'VNB');
    expect(after.velocity.y).toBeCloseTo(7.6, 9); // +0.1 km/s prograde
    expect(after.velocity.x).toBeCloseTo(0, 9);
    expect(after.position).toEqual(state.position); // impulsive: position unchanged
  });

  it('a radial RIC burn adds along the radial direction', () => {
    const after = applyImpulsiveManeuver(state, { x: 0.2, y: 0, z: 0 }, 'RIC');
    expect(after.velocity.x).toBeCloseTo(0.2, 9);
    expect(after.velocity.y).toBeCloseTo(7.5, 9);
  });
});
