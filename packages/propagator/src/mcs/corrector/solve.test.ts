// The headline corrector oracles: a downrange-radius target solved with ZERO extra
// propagations (pure STM Jacobian), an apoapsis raise matched to the closed-form vis-viva
// delta-v, a flight-path-angle null, and a finite-difference path forced by a geometric
// stop. Each is checked against an independent computation, not the corrector's own state.
// (STK_PARITY_SPEC §4.3.)

import { describe, it, expect } from 'vitest';
import { runMcs } from '../executor.ts';
import { createMissionEnv } from '../env.ts';
import type { Mcs, Segment } from '../segments.ts';

const MU = 398600.4418;
const RE = 6378.137;
const env = createMissionEnv(new Map([[399, { gm: MU, bodyRadius: RE }]]), { rtol: 1e-12, atol: 1e-12 });

const ini = (r: { x: number; y: number; z: number }, v: { x: number; y: number; z: number }): Segment => ({
  kind: 'InitialState',
  id: 'ini',
  epoch: 0,
  centralBody: 399,
  mass: 1000,
  frame: 'J2000',
  coord: { type: 'Cartesian', r, v },
});

const vCirc = Math.sqrt(MU / 7000);

describe('differential corrector convergence', () => {
  it('downrange radius converges with zero extra propagations (pure STM)', () => {
    const mcs: Mcs = {
      version: 1,
      root: {
        kind: 'Sequence',
        id: 'root',
        children: [
          ini({ x: 7000, y: 0, z: 0 }, { x: 0, y: vCirc, z: 0 }),
          {
            kind: 'Target',
            id: 'tgt',
            corrector: 'DifferentialCorrector',
            controls: [{ segment: 'burn', param: 'Maneuver.dv.x', perturbation: 1e-5, initial: 0.02, maxStep: 0.3 }],
            goals: [{ evalAt: 'End', type: 'Radius', desired: 7100, tolerance: 1e-4 }],
            children: [
              { kind: 'Maneuver', id: 'burn', mode: 'Impulsive', attitude: 'VNB', dv: { x: 0.02, y: 0, z: 0 } },
              { kind: 'Propagate', id: 'coast', model: 'TwoBody', maxDuration: 1500, stop: [{ type: 'Duration', value: 1500 }] },
            ],
          },
        ],
      },
    };
    const run = runMcs(mcs, env);
    const rep = run.targetReports[0]!;
    expect(rep.converged).toBe(true);
    expect(rep.extraRuns).toBe(0); // STM-served control + analytic goal + fixed-time stop
    expect(Math.hypot(run.final.r.x, run.final.r.y, run.final.r.z)).toBeCloseTo(7100, 3);
  });

  it('raise-apoapsis matches the vis-viva delta-v', () => {
    const a2 = (7000 + 9000) / 2;
    const vPeri = Math.sqrt(MU * (2 / 7000 - 1 / a2));
    const dvExpected = vPeri - vCirc;
    const mcs: Mcs = {
      version: 1,
      root: {
        kind: 'Sequence',
        id: 'root',
        children: [
          ini({ x: 7000, y: 0, z: 0 }, { x: 0, y: vCirc, z: 0 }),
          {
            kind: 'Target',
            id: 'tgt',
            corrector: 'DifferentialCorrector',
            controls: [{ segment: 'burn', param: 'Maneuver.dv.x', perturbation: 1e-6, initial: 0.3, maxStep: 0.5 }],
            goals: [{ evalAt: 'End', type: 'RadiusOfApoapsis', desired: 9000, tolerance: 1e-5 }],
            children: [
              { kind: 'Maneuver', id: 'burn', mode: 'Impulsive', attitude: 'VNB', dv: { x: 0.3, y: 0, z: 0 } },
              { kind: 'Propagate', id: 'coast', model: 'TwoBody', maxDuration: 60, stop: [{ type: 'Duration', value: 60 }] },
            ],
          },
        ],
      },
    };
    const run = runMcs(mcs, env);
    const rep = run.targetReports[0]!;
    expect(rep.converged).toBe(true);
    expect(rep.extraRuns).toBeGreaterThan(0); // element goal => finite-difference columns
    expect(rep.controls[0]).toBeCloseTo(dvExpected, 5);
  });

  it('nulls the flight-path angle with a radial burn', () => {
    const a = 7000 / (1 - 0.1);
    const vPeri = Math.sqrt(MU * (2 / 7000 - 1 / a));
    const mcs: Mcs = {
      version: 1,
      root: {
        kind: 'Sequence',
        id: 'root',
        children: [
          ini({ x: 7000, y: 0, z: 0 }, { x: 0, y: vPeri, z: 0 }),
          { kind: 'Propagate', id: 'climb', model: 'TwoBody', maxDuration: 1000, stop: [{ type: 'Duration', value: 1000 }] },
          {
            kind: 'Target',
            id: 'tgt',
            corrector: 'DifferentialCorrector',
            controls: [{ segment: 'burn', param: 'Maneuver.dv.z', perturbation: 1e-6, initial: 0, maxStep: 1 }],
            goals: [{ evalAt: 'End', type: 'FlightPathAngle', desired: 0, tolerance: 1e-9 }],
            children: [
              { kind: 'Maneuver', id: 'burn', mode: 'Impulsive', attitude: 'VNB', dv: { x: 0, y: 0, z: 0 } },
              { kind: 'Propagate', id: 'settle', model: 'TwoBody', maxDuration: 1, stop: [{ type: 'Duration', value: 1 }] },
            ],
          },
        ],
      },
    };
    const run = runMcs(mcs, env);
    const rep = run.targetReports[0]!;
    expect(rep.converged).toBe(true);
    const f = run.final;
    const rdotv = f.r.x * f.v.x + f.r.y * f.v.y + f.r.z * f.v.z;
    expect(Math.abs(rdotv)).toBeLessThan(1e-4); // r.v ~ 0 => flight-path angle ~ 0
  });

  it('converges through the finite-difference path on a geometric (apoapsis) stop', () => {
    const a2 = (7000 + 9000) / 2;
    const vPeri = Math.sqrt(MU * (2 / 7000 - 1 / a2));
    const dvExpected = vPeri - vCirc;
    const mcs: Mcs = {
      version: 1,
      root: {
        kind: 'Sequence',
        id: 'root',
        children: [
          ini({ x: 7000, y: 0, z: 0 }, { x: 0, y: vCirc, z: 0 }),
          {
            kind: 'Target',
            id: 'tgt',
            corrector: 'DifferentialCorrector',
            controls: [{ segment: 'burn', param: 'Maneuver.dv.x', perturbation: 1e-6, initial: 0.3, maxStep: 0.5 }],
            goals: [{ evalAt: 'End', type: 'Radius', desired: 9000, tolerance: 1e-4 }],
            children: [
              { kind: 'Maneuver', id: 'burn', mode: 'Impulsive', attitude: 'VNB', dv: { x: 0.3, y: 0, z: 0 } },
              { kind: 'Propagate', id: 'coast', model: 'TwoBody', maxDuration: 6000, stop: [{ type: 'Apoapsis' }] },
            ],
          },
        ],
      },
    };
    const run = runMcs(mcs, env);
    const rep = run.targetReports[0]!;
    expect(rep.converged).toBe(true);
    expect(rep.extraRuns).toBeGreaterThan(0); // geometric stop forces finite difference
    expect(rep.controls[0]).toBeCloseTo(dvExpected, 4);
    expect(Math.hypot(run.final.r.x, run.final.r.y, run.final.r.z)).toBeCloseTo(9000, 3);
  });
});
