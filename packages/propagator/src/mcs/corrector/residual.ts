// One evaluation of the corrector residual: write the control vector into a fresh child
// tree, execute it segment by segment (capturing the pre-burn states the Jacobian seeds
// from, the per-goal evaluation states, and the coast STM), and form the weighted/scaled
// residual vector. Pure with respect to the input state, so the Newton loop can call it
// freely. (STK_PARITY_SPEC §4.3.)

import type { MissionEnv } from '../env.ts';
import type { Segment } from '../segments.ts';
import type { MissionState, SegmentResult, SegmentStatus, StateSample } from '../state.ts';
import type { ControlBinding, GoalBinding } from './refs.ts';
import { StopConditionNeverTriggeredError } from '../errors.ts';

export interface DcEvalContext {
  readonly children: readonly Segment[];
  readonly goals: readonly GoalBinding[];
  readonly input: MissionState;
  readonly env: MissionEnv;
  readonly mu: number;
  execOne(seg: Segment, input: MissionState, wantStm: boolean): SegmentResult;
}

export interface ResidualEval {
  /** Weighted, tolerance-normalized residual (length m). */
  readonly residualScaled: Float64Array;
  /** Raw residual achieved - desired per goal (length m). */
  readonly residualRaw: Float64Array;
  readonly evalStates: ReadonlyMap<string, MissionState>;
  readonly burnStates: ReadonlyMap<string, MissionState>;
  readonly samples: readonly StateSample[];
  readonly stmAt?: (et: number) => Float64Array;
  readonly stmEpoch?: number;
}

export function evaluateResidual(
  c: Float64Array,
  controls: readonly ControlBinding[],
  ctx: DcEvalContext,
  wantStm: boolean,
): ResidualEval {
  // Write every control value into a fresh tree.
  let tree: readonly Segment[] = ctx.children;
  for (let j = 0; j < controls.length; j++) tree = controls[j]!.write(tree, c[j]!);

  let state = ctx.input;
  const evalStates = new Map<string, MissionState>();
  const burnStates = new Map<string, MissionState>();
  const statusById = new Map<string, SegmentStatus>();
  const samples: StateSample[] = [];
  let stmAt: ((et: number) => Float64Array) | undefined;
  let stmEpoch: number | undefined;
  let lastId = 'End';

  for (const child of tree) {
    if (child.kind === 'Maneuver') burnStates.set(child.id, state);
    const r = ctx.execOne(child, state, wantStm);
    state = r.out;
    if (r.stmAt) {
      stmAt = r.stmAt;
      stmEpoch = r.stmEpoch;
    }
    evalStates.set(child.id, state);
    statusById.set(child.id, r.status);
    for (const s of r.samples) {
      const tail = samples[samples.length - 1];
      if (tail && Math.abs(tail.et - s.et) < 1e-9) continue;
      samples.push(s);
    }
    lastId = child.id;
  }
  evalStates.set('End', state);
  statusById.set('End', statusById.get(lastId) ?? { kind: 'ok' });

  const m = ctx.goals.length;
  const residualRaw = new Float64Array(m);
  const residualScaled = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    const goal = ctx.goals[i]!;
    const at = evalStates.get(goal.evalAt);
    if (!at) throw new StopConditionNeverTriggeredError([], goal.evalAt);
    const st = statusById.get(goal.evalAt);
    if (st?.kind === 'backstop') throw new StopConditionNeverTriggeredError([], goal.evalAt);
    const raw = goal.residual(at, ctx.mu);
    residualRaw[i] = raw;
    residualScaled[i] = (raw * goal.weight) / goal.tolerance;
  }

  return { residualScaled, residualRaw, evalStates, burnStates, samples, stmAt, stmEpoch };
}
