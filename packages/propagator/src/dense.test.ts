// The dense (continuous) DOPRI5 extension must interpolate the state at OFF-grid epochs
// to the same accuracy the stepper achieves on-grid: validated against CSPICE prop2b
// for a point-mass arc (the primary oracle), an energy invariant along the interpolant,
// the endpoint identity, and the OutOfDomainError guard. (STK_PARITY_SPEC §4.2.)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import { createSpiceEngine, type CartesianState, type SpiceEngine } from '@bessel/spice';
import { integrateDense } from './dense.ts';
import { OutOfDomainError } from './errors.ts';
import { createForceModel } from './force/model.ts';
import { pointMass } from './force/point-mass.ts';
import type { Rhs } from './integrator.ts';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(fileURLToPath(new URL(`../../../kernels/fixtures/${name}`, import.meta.url))));

const EARTH = { gm: 398600.4418 };
const ECCENTRIC: CartesianState = {
  position: { x: 7000, y: 0, z: 0 },
  velocity: { x: 0, y: 6.5, z: 3.0 },
};

const pointMassRhs = (gm: number): Rhs => {
  const fm = createForceModel([pointMass(gm)]);
  return (t, y, dy) => {
    const a = fm.acceleration({ et: t, r: [y[0]!, y[1]!, y[2]!], v: [y[3]!, y[4]!, y[5]!] });
    dy[0] = y[3]!;
    dy[1] = y[4]!;
    dy[2] = y[5]!;
    dy[3] = a[0];
    dy[4] = a[1];
    dy[5] = a[2];
  };
};

const stateOf = (s: CartesianState): Float64Array =>
  Float64Array.of(s.position.x, s.position.y, s.position.z, s.velocity.x, s.velocity.y, s.velocity.z);

describe('Dense DOPRI5 continuous extension', () => {
  let spice: SpiceEngine;
  beforeAll(async () => {
    spice = await createSpiceEngine();
    await spice.furnsh('naif0012.tls', fixture('naif0012.tls'));
  });

  it('interpolates point-mass states off-grid to sub-meter vs prop2b', async () => {
    const y0 = stateOf(ECCENTRIC);
    const { solution } = integrateDense(pointMassRhs(EARTH.gm), y0, 0, 6000, { rtol: 1e-12, atol: 1e-12 });
    // Deliberately OFF the integrator's internal steps: irrational-ish offsets.
    for (const t of [137.3, 901.7, 2718.28, 4242.0, 5999.5]) {
      const got = solution.interpolate(t);
      const ref = await spice.prop2b(EARTH.gm, ECCENTRIC, t);
      expect(got[0]).toBeCloseTo(ref.position.x, 3); // 1 m
      expect(got[1]).toBeCloseTo(ref.position.y, 3);
      expect(got[2]).toBeCloseTo(ref.position.z, 3);
      expect(got[3]).toBeCloseTo(ref.velocity.x, 6);
      expect(got[4]).toBeCloseTo(ref.velocity.y, 6);
      expect(got[5]).toBeCloseTo(ref.velocity.z, 6);
    }
  });

  it('reproduces the initial state at t0 (endpoint identity)', () => {
    const y0 = stateOf(ECCENTRIC);
    const { solution } = integrateDense(pointMassRhs(EARTH.gm), y0, 0, 3000);
    const at0 = solution.interpolate(0);
    for (let i = 0; i < 6; i++) expect(at0[i]).toBeCloseTo(y0[i]!, 9);
  });

  it('conserves specific energy along the interpolant (not just at nodes)', () => {
    const y0 = stateOf(ECCENTRIC);
    const { solution } = integrateDense(pointMassRhs(EARTH.gm), y0, 0, 6000, { rtol: 1e-12, atol: 1e-12 });
    const energy = (y: Float64Array): number =>
      0.5 * (y[3]! ** 2 + y[4]! ** 2 + y[5]! ** 2) - EARTH.gm / Math.hypot(y[0]!, y[1]!, y[2]!);
    const e0 = energy(solution.interpolate(0));
    for (let t = 50; t < 6000; t += 173) {
      expect(Math.abs((energy(solution.interpolate(t)) - e0) / e0)).toBeLessThan(1e-8);
    }
  });

  it('throws OutOfDomainError outside [t0, tf]', () => {
    const y0 = stateOf(ECCENTRIC);
    const { solution } = integrateDense(pointMassRhs(EARTH.gm), y0, 0, 1000);
    expect(() => solution.interpolate(-5)).toThrow(OutOfDomainError);
    expect(() => solution.interpolate(solution.tf + 5)).toThrow(OutOfDomainError);
  });

  it('rejects a non-positive span', () => {
    const y0 = stateOf(ECCENTRIC);
    expect(() => integrateDense(pointMassRhs(EARTH.gm), y0, 0, 0)).toThrow(/tf > t0/);
  });
});
