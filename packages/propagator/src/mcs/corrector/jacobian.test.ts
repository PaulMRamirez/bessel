// The STM-analytic Jacobian column must agree with an independent finite difference of the
// full residual: this isolates a wrong Phi index or a wrong gradient sign before it can
// poison convergence. Plus the mayRetargetStop predicate that routes geometric-stop coasts
// to finite difference. (STK_PARITY_SPEC §4.3.)

import { describe, it, expect } from 'vitest';
import { runSegment } from '../executor.ts';
import { createMissionEnv } from '../env.ts';
import { bindControls, bindGoals } from './refs.ts';
import { evaluateResidual, type DcEvalContext } from './residual.ts';
import { assembleJacobian, mayRetargetStop } from './jacobian.ts';
import { DEFAULT_DC_SETTINGS, type Segment } from '../segments.ts';
import type { MissionState } from '../state.ts';

const MU = 398600.4418;
const env = createMissionEnv(new Map([[399, { gm: MU, bodyRadius: 6378.137 }]]), { rtol: 1e-12, atol: 1e-12 });
const vCirc = Math.sqrt(MU / 7000);

const input: MissionState = {
  epoch: 0,
  r: { x: 7000, y: 0, z: 0 },
  v: { x: 0, y: vCirc, z: 0 },
  mass: 1000,
  centralBody: 399,
  segmentPath: ['ini'],
};

const children: Segment[] = [
  { kind: 'Maneuver', id: 'burn', mode: 'Impulsive', attitude: 'VNB', dv: { x: 0.03, y: 0, z: 0 } },
  { kind: 'Propagate', id: 'coast', model: 'TwoBody', maxDuration: 1500, stop: [{ type: 'Duration', value: 1500 }] },
];

describe('Jacobian STM column vs finite difference', () => {
  it('agrees on d(Radius)/d(dv_x) to better than 1e-4 relative', () => {
    const controls = bindControls(children, [{ segment: 'burn', param: 'Maneuver.dv.x', perturbation: 1e-6 }]);
    const goals = bindGoals([{ evalAt: 'End', type: 'Radius', desired: 7100, tolerance: 1e-4 }]);
    const ctx: DcEvalContext = {
      children,
      goals,
      input,
      env,
      mu: MU,
      execOne: (s, state, wantStm) => runSegment(s, state, env, { stm: wantStm }),
    };
    const c = Float64Array.of(0.03);

    const base = evaluateResidual(c, controls, ctx, true);
    const stmJac = assembleJacobian(c, base, controls, goals, ctx, { ...DEFAULT_DC_SETTINGS, useStm: true });
    const fdJac = assembleJacobian(c, base, controls, goals, ctx, { ...DEFAULT_DC_SETTINGS, useStm: false, useCentralDifference: true });

    expect(stmJac.extraRuns).toBe(0);
    expect(fdJac.extraRuns).toBe(2); // central difference: two propagations
    const rel = Math.abs(stmJac.J[0]! - fdJac.J[0]!) / Math.abs(fdJac.J[0]!);
    expect(rel).toBeLessThan(1e-4);
  });
});

describe('mayRetargetStop', () => {
  const ctrl = bindControls(children, [{ segment: 'burn', param: 'Maneuver.dv.x', perturbation: 1e-6 }])[0]!;

  it('is false for a fixed-duration coast', () => {
    expect(mayRetargetStop(children, ctrl)).toBe(false);
  });

  it('is true for a coast with a geometric stop', () => {
    const geo: Segment[] = [
      children[0]!,
      { kind: 'Propagate', id: 'coast', model: 'TwoBody', maxDuration: 6000, stop: [{ type: 'Apoapsis' }] },
    ];
    expect(mayRetargetStop(geo, ctrl)).toBe(true);
  });
});
