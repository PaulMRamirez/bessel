// Assemble the corrector Jacobian d(scaled residual)/d(nondim control). A column is built
// analytically from the coast STM when the control is STM-served (a delta-v or initial
// r/v), every goal supplies a closed-form dg/dx, and no geometric stop can shift the
// evaluation epoch (mayRetargetStop) - then it costs ZERO extra propagations. Otherwise the
// column is finite-differenced by re-running the residual. (STK_PARITY_SPEC §4.3.)

import type { DcSettings, PropagateSegment, Segment, StopCondition } from '../segments.ts';
import type { ControlBinding, GoalBinding } from './refs.ts';
import { evaluateResidual, type DcEvalContext, type ResidualEval } from './residual.ts';
import { vnbAxisToInertial } from '../frames.ts';

export interface JacobianResult {
  /** Row-major m x n Jacobian in scaled/nondimensional units. */
  readonly J: Float64Array;
  readonly rows: number;
  readonly cols: number;
  /** Extra residual propagations spent on finite-difference columns. */
  readonly extraRuns: number;
}

/** True if a control could move which event ends a geometric-stop coast (so the STM, which
 * holds the evaluation epoch fixed, would miss the stop-time sensitivity: fall back to FD). */
export function mayRetargetStop(children: readonly Segment[], _control: ControlBinding): boolean {
  const geometric = (s: StopCondition): boolean => s.type !== 'Duration' && s.type !== 'Epoch';
  const scan = (segs: readonly Segment[]): boolean =>
    segs.some((seg) => {
      if (seg.kind === 'Propagate') return (seg as PropagateSegment).stop.some(geometric);
      if (seg.kind === 'Sequence' || seg.kind === 'Target') return scan(seg.children);
      return false;
    });
  return scan(children);
}

/** Multiply a row-major 6x6 STM by a 6-vector seed. */
function phiTimes(phi: Float64Array, seed: Float64Array): Float64Array {
  const out = new Float64Array(6);
  for (let row = 0; row < 6; row++) {
    let s = 0;
    for (let col = 0; col < 6; col++) s += phi[row * 6 + col]! * seed[col]!;
    out[row] = s;
  }
  return out;
}

export function assembleJacobian(
  c: Float64Array,
  base: ResidualEval,
  controls: readonly ControlBinding[],
  goals: readonly GoalBinding[],
  ctx: DcEvalContext,
  settings: DcSettings,
): JacobianResult {
  const m = goals.length;
  const n = controls.length;
  const J = new Float64Array(m * n);
  let extraRuns = 0;

  const allGoalsAnalytic = goals.every((g, i) => g.gradWrtState(stateFor(base, g), ctx.mu) !== null && hasEval(base, g, i));
  const retarget = (cb: ControlBinding): boolean => mayRetargetStop(ctx.children, cb);

  for (let j = 0; j < n; j++) {
    const ctrl = controls[j]!;
    const stmOk = settings.useStm && ctrl.stmServed && !!base.stmAt && !retarget(ctrl) && allGoalsAnalytic && !!ctrl.seedAxis;

    if (stmOk) {
      const seed = seedVector(base, ctrl);
      for (let i = 0; i < m; i++) {
        const goal = goals[i]!;
        const at = stateFor(base, goal);
        const phi = base.stmAt!(at.epoch);
        const dxEval = phiTimes(phi, seed);
        const grad = goal.gradWrtState(at, ctx.mu)!;
        let draw = 0;
        for (let k = 0; k < 6; k++) draw += grad[k]! * dxEval[k]!;
        J[i * n + j] = (draw * goal.weight * ctrl.scale) / goal.tolerance;
      }
      continue;
    }

    // Finite difference (forward, or central when configured).
    const step = Math.max(settings.perturbationRel * Math.max(Math.abs(c[j]!), ctrl.scale), ctrl.perturbation);
    const cPlus = Float64Array.from(c);
    cPlus[j] = c[j]! + step;
    const evPlus = evaluateResidual(cPlus, controls, ctx, false);
    extraRuns += 1;
    let evMinusScaled: Float64Array | null = null;
    if (settings.useCentralDifference) {
      const cMinus = Float64Array.from(c);
      cMinus[j] = c[j]! - step;
      evMinusScaled = evaluateResidual(cMinus, controls, ctx, false).residualScaled;
      extraRuns += 1;
    }
    const dNondim = step / ctrl.scale;
    for (let i = 0; i < m; i++) {
      J[i * n + j] = evMinusScaled
        ? (evPlus.residualScaled[i]! - evMinusScaled[i]!) / (2 * dNondim)
        : (evPlus.residualScaled[i]! - base.residualScaled[i]!) / dNondim;
    }
  }

  return { J, rows: m, cols: n, extraRuns };
}

/** The eval state for a goal (falls back to the End state). */
function stateFor(base: ResidualEval, goal: GoalBinding) {
  return base.evalStates.get(goal.evalAt) ?? base.evalStates.get('End')!;
}

function hasEval(base: ResidualEval, goal: GoalBinding, _i: number): boolean {
  return base.evalStates.has(goal.evalAt) || base.evalStates.has('End');
}

/** The 6-vector perturbation a unit of the control injects at the arc-start epoch. */
function seedVector(base: ResidualEval, ctrl: ControlBinding): Float64Array {
  const a = ctrl.seedAxis!;
  if (a.kind === 'dv') {
    const burn = base.burnStates.get(a.segment);
    const dir = burn ? vnbAxisToInertial(a.attitude, a.axis, burn.r, burn.v) : { x: a.axis === 'x' ? 1 : 0, y: a.axis === 'y' ? 1 : 0, z: a.axis === 'z' ? 1 : 0 };
    return Float64Array.of(0, 0, 0, dir.x, dir.y, dir.z);
  }
  const idx = (a.kind === 'r' ? 0 : 3) + (a.axis === 'x' ? 0 : a.axis === 'y' ? 1 : 2);
  const seed = new Float64Array(6);
  seed[idx] = 1;
  return seed;
}
