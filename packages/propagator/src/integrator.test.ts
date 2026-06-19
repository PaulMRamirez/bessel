// PRIMARY oracle: the DOPRI5 Cowell integrator must reproduce CSPICE prop2b for a
// pure point-mass force, to sub-meter. Plus self-contained conservation invariants
// and an independent fixed-step RK4 cross-check. (STK_PARITY_SPEC §4.2.)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import { createSpiceEngine, type CartesianState, type SpiceEngine } from '@bessel/spice';
import { propagateCowell } from './cowell.ts';
import { createForceModel } from './force/model.ts';
import { pointMass } from './force/point-mass.ts';
import { zonalHarmonics } from './force/zonal.ts';
import type { ForceModel } from './force/types.ts';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(fileURLToPath(new URL(`../../../kernels/fixtures/${name}`, import.meta.url))));

const EARTH = { gm: 398600.4418, j2: 1.08262668e-3, re: 6378.137 };

// A circular LEO and an eccentric, inclined orbit (stresses step control at periapsis).
const CIRCULAR: CartesianState = {
  position: { x: 7000, y: 0, z: 0 },
  velocity: { x: 0, y: Math.sqrt(EARTH.gm / 7000), z: 0 },
};
const ECCENTRIC: CartesianState = {
  position: { x: 7000, y: 0, z: 0 },
  velocity: { x: 0, y: 6.5, z: 3.0 },
};

describe('Cowell integrator vs prop2b (point-mass)', () => {
  let spice: SpiceEngine;
  beforeAll(async () => {
    spice = await createSpiceEngine();
    await spice.furnsh('naif0012.tls', fixture('naif0012.tls'));
  });

  for (const [label, state] of [
    ['circular', CIRCULAR],
    ['eccentric', ECCENTRIC],
  ] as const) {
    it(`matches prop2b to sub-meter for the ${label} orbit`, async () => {
      const grid = Float64Array.from({ length: 21 }, (_, k) => k * 300); // 0..6000 s
      const fm = createForceModel([pointMass(EARTH.gm)]);
      const table = propagateCowell({
        state,
        epoch: 0,
        etGrid: grid,
        forceModel: fm,
        tolerances: { rtol: 1e-12, atol: 1e-12 },
      });
      for (let k = 0; k < grid.length; k++) {
        const ref = await spice.prop2b(EARTH.gm, state, grid[k]!);
        expect(table.x[k]).toBeCloseTo(ref.position.x, 3); // 1e-3 km = 1 m
        expect(table.y[k]).toBeCloseTo(ref.position.y, 3);
        expect(table.z[k]).toBeCloseTo(ref.position.z, 3);
        expect(table.vx[k]).toBeCloseTo(ref.velocity.x, 6);
        expect(table.vy[k]).toBeCloseTo(ref.velocity.y, 6);
        expect(table.vz[k]).toBeCloseTo(ref.velocity.z, 6);
      }
    });
  }
});

describe('Cowell integrator conservation (point-mass only)', () => {
  it('conserves specific energy and angular momentum', () => {
    const grid = Float64Array.from({ length: 41 }, (_, k) => k * 200);
    const fm = createForceModel([pointMass(EARTH.gm)]);
    const t = propagateCowell({ state: ECCENTRIC, epoch: 0, etGrid: grid, forceModel: fm });
    const energyAt = (k: number): number => {
      const v2 = t.vx[k]! ** 2 + t.vy[k]! ** 2 + t.vz[k]! ** 2;
      const r = Math.hypot(t.x[k]!, t.y[k]!, t.z[k]!);
      return 0.5 * v2 - EARTH.gm / r;
    };
    const hAt = (k: number): number => {
      // |r x v|
      const hx = t.y[k]! * t.vz[k]! - t.z[k]! * t.vy[k]!;
      const hy = t.z[k]! * t.vx[k]! - t.x[k]! * t.vz[k]!;
      const hz = t.x[k]! * t.vy[k]! - t.y[k]! * t.vx[k]!;
      return Math.hypot(hx, hy, hz);
    };
    const e0 = energyAt(0);
    const h0 = hAt(0);
    for (let k = 1; k < grid.length; k++) {
      expect(Math.abs((energyAt(k) - e0) / e0)).toBeLessThan(1e-9);
      expect(Math.abs((hAt(k) - h0) / h0)).toBeLessThan(1e-9);
    }
  });
});

describe('Cowell vs an independent RK4 (point-mass + J2)', () => {
  it('agrees with a fixed-step RK4 on the J2 model', () => {
    const fm: ForceModel = createForceModel([pointMass(EARTH.gm), zonalHarmonics(EARTH, { j2: EARTH.j2 })]);
    // Fixed-step RK4, fully independent of the DOPRI5 tableau.
    const deriv = (y: number[]): number[] => {
      const a = fm.acceleration({ et: 0, r: [y[0]!, y[1]!, y[2]!], v: [y[3]!, y[4]!, y[5]!] });
      return [y[3]!, y[4]!, y[5]!, a[0], a[1], a[2]];
    };
    const add = (y: number[], dy: number[], s: number): number[] => y.map((yi, i) => yi + s * dy[i]!);
    let y: number[] = [7000, 0, 0, 0, 6.5, 3.0];
    const h = 5;
    const steps = 400; // 2000 s
    for (let i = 0; i < steps; i++) {
      const k1 = deriv(y);
      const k2 = deriv(add(y, k1, h / 2));
      const k3 = deriv(add(y, k2, h / 2));
      const k4 = deriv(add(y, k3, h));
      y = y.map((yi, j) => yi + (h / 6) * (k1[j]! + 2 * k2[j]! + 2 * k3[j]! + k4[j]!));
    }
    const table = propagateCowell({
      state: { position: { x: 7000, y: 0, z: 0 }, velocity: { x: 0, y: 6.5, z: 3.0 } },
      epoch: 0,
      etGrid: Float64Array.of(2000),
      forceModel: fm,
    });
    expect(table.x[0]).toBeCloseTo(y[0]!, 1); // within 0.1 km of the independent RK4
    expect(table.y[0]).toBeCloseTo(y[1]!, 1);
    expect(table.z[0]).toBeCloseTo(y[2]!, 1);
  });
});
