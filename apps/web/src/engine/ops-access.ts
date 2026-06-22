// Per-domain analysis ops for the Access & Comms tab (analysis-UX Phase 1): the composable
// access constraint stack and the selectable-pointing in-FOV sweep. Split out of analysis-ops.ts
// so the Access-specific surface (and the @bessel/access + in-fov geometry it pulls) lands in
// the lazy analysis chunk on first use, behind the engine's dynamic-import boundary. Each op is
// standalone, taking the engine core + store + a disposed guard, mirroring analysis-ops.ts.
// Fails loud: a malformed constraint or an unresolved body raises a typed, located error.

import { computeAccess, type AccessConstraint } from '@bessel/access';
import { figureOfMerit } from '@bessel/coverage';
import { windowIntersect, type Window } from '@bessel/timeline';
import { DEG2RAD } from '../angles.ts';
import { positionAt } from '../sampler.ts';
import {
  fovHalfAngleRad,
  pointingOffAngleRad,
  intervalsFromFlags,
  type FovPointing,
} from '../in-fov.ts';
import {
  DEFAULT_ACCESS_CONSTRAINTS,
  type AccessConstraintSpec,
} from './analysis-defaults.ts';
import type { AppStore, AccessFom } from '../store/index.ts';
import type { EngineCore } from './bootstrap.ts';

/** A typed, located error for an Access-tab op the engine cannot satisfy (fail loudly). */
export class OpsAccessError extends Error {
  override readonly name = 'OpsAccessError';
  constructor(message: string) {
    super(`ops-access: ${message}`);
  }
}

/** One labelled member of the assembled access stack: the constraint to run plus the chip
 *  text the panel shows for it. Kept alongside the constraint so the per-constraint breakdown
 *  (each constraint run alone) can name how each narrowed the window. */
export interface LabelledConstraint {
  readonly label: string;
  readonly constraint: AccessConstraint;
}

/** Assemble the enabled members of a constraint spec into labelled access constraints, in a
 *  stable order. Pure (no SPICE), so the assembly is unit-tested directly. The line-of-sight
 *  occulting body is the mission center body; range/range-rate/sun-keepout read their bands
 *  from the spec. A spec with nothing enabled yields an empty stack (computeAccess then returns
 *  the whole span). Fails loud on an inverted band rather than silently swapping the bounds. */
export function assembleConstraints(
  spec: AccessConstraintSpec,
  centerBody: string,
): readonly LabelledConstraint[] {
  const out: LabelledConstraint[] = [];
  if (spec.losEnabled) {
    out.push({
      label: `Line of sight (not occulted by ${centerBody})`,
      constraint: { kind: 'lineOfSight', body: centerBody, bodyFrame: `IAU_${centerBody.toUpperCase()}` },
    });
  }
  if (spec.rangeEnabled) {
    if (spec.rangeMaxKm < spec.rangeMinKm) {
      throw new OpsAccessError(
        `range band is empty: maxKm (${spec.rangeMaxKm}) is below minKm (${spec.rangeMinKm})`,
      );
    }
    out.push({
      label: `Range ${spec.rangeMinKm} to ${spec.rangeMaxKm} km`,
      constraint: { kind: 'range', minKm: spec.rangeMinKm, maxKm: spec.rangeMaxKm },
    });
  }
  if (spec.rangeRateEnabled) {
    if (spec.rangeRateMaxKmS < spec.rangeRateMinKmS) {
      throw new OpsAccessError(
        `range-rate band is empty: maxKmS (${spec.rangeRateMaxKmS}) is below minKmS (${spec.rangeRateMinKmS})`,
      );
    }
    out.push({
      label: `Range rate ${spec.rangeRateMinKmS} to ${spec.rangeRateMaxKmS} km/s`,
      constraint: { kind: 'rangeRate', minKmS: spec.rangeRateMinKmS, maxKmS: spec.rangeRateMaxKmS },
    });
  }
  if (spec.sunKeepoutEnabled) {
    if (!(spec.sunKeepoutDeg > 0)) {
      throw new OpsAccessError(`sun keep-out must be > 0 deg, got ${spec.sunKeepoutDeg}`);
    }
    out.push({
      label: `Sun keep-out >= ${spec.sunKeepoutDeg} deg`,
      constraint: { kind: 'sunExclusion', keepoutRad: spec.sunKeepoutDeg * DEG2RAD },
    });
  }
  return out;
}

const fomOf = (window: Window, span: readonly [number, number]): AccessFom => {
  const f = figureOfMerit(window, span);
  return { percentCoverage: f.percentCoverage, accessCount: f.accessCount, maxGapSec: f.maxGapSec };
};

/**
 * Composable access stack: run computeAccess over the assembled constraint array (the
 * surviving window is the intersection of the enabled constraints), reduce it to a figure
 * of merit, and build a per-constraint breakdown by running EACH enabled constraint alone so
 * the panel can show how much each one narrowed the span. Requires a spacecraft mission; a
 * no-op (clears the result) otherwise. (analysis-UX section 4, observation planner.)
 */
export async function computeAccessStack(
  e: EngineCore,
  store: AppStore,
  isDisposed: () => boolean,
  spec: AccessConstraintSpec = DEFAULT_ACCESS_CONSTRAINTS,
  target?: string,
  opts: { spanSec?: number; stepSec?: number } = {},
): Promise<void> {
  const sc = e.identity.spacecraftName;
  const body = e.identity.centerBody;
  if (!sc || !body) {
    store.setState({ accessResult: null, accessBreakdown: null });
    return;
  }
  const obsTarget = target ?? 'SUN';
  const t0 = e.clock.state.et;
  const step = opts.stepSec ?? 120;
  const span: [number, number] = [t0, t0 + (opts.spanSec ?? 86400)];
  const labelled = assembleConstraints(spec, body);
  try {
    const window = await computeAccess(e.spice, {
      observer: sc,
      target: obsTarget,
      span,
      step,
      constraints: labelled.map((l) => l.constraint),
    });
    // Per-constraint breakdown: each enabled constraint run on its own over the span, so the
    // note reports the coverage each one admits in isolation (how much it narrows the span).
    const breakdown = await Promise.all(
      labelled.map(async (l) => {
        const lone = await computeAccess(e.spice, {
          observer: sc,
          target: obsTarget,
          span,
          step,
          constraints: [l.constraint],
        });
        return { label: l.label, fom: fomOf(lone, span) };
      }),
    );
    if (!isDisposed()) {
      store.setState({
        accessResult: { window, span, label: `${sc} to ${obsTarget}`, fom: fomOf(window, span) },
        accessBreakdown: breakdown,
      });
    }
  } catch (err) {
    if (!isDisposed()) store.setState({ accessResult: null, accessBreakdown: null });
    console.error('access-stack analysis failed', err);
    throw err;
  }
}

/**
 * Selectable-pointing in-FOV sweep: model the sensor boresight along the chosen mode (nadir
 * toward the center body, or sun toward the Sun) and find when the observation target falls
 * within the FOV half-angle. Reports BOTH the FOV-only window and the post-constraint surviving
 * window (FOV intersected with the assembled access stack), so the planner reads how the
 * constraints narrow the raw geometric visibility. Reuses the sampled ephemeris table (no extra
 * worker round-trips). Requires a sensor + spacecraft; a no-op (clears) otherwise.
 */
export async function computeFovWindows(
  e: EngineCore,
  store: AppStore,
  isDisposed: () => boolean,
  pointing: FovPointing = 'nadir',
  spec: AccessConstraintSpec = DEFAULT_ACCESS_CONSTRAINTS,
  target?: string,
  opts: { spanSec?: number; stepSec?: number } = {},
): Promise<void> {
  const inst = e.instrument;
  const sc = e.identity.spacecraftName;
  const center = e.identity.centerBody;
  const obsTarget = target ?? 'Sun';
  // Sun pointing also needs the Sun sampled; nadir pointing does not.
  const needsSun = pointing === 'sun';
  if (
    !inst ||
    !sc ||
    !center ||
    !e.table.byBody.has(obsTarget) ||
    !e.table.byBody.has(sc) ||
    !e.table.byBody.has(center) ||
    (needsSun && !e.table.byBody.has('Sun'))
  ) {
    store.setState({ fovResult: null, fovSurviving: null });
    return;
  }
  const t0 = e.clock.state.et;
  // Clamp the sweep to the sampled ephemeris window (positionAt clamps out-of-range epochs to
  // the table edge, which would fabricate a frozen in/out result past the data).
  const span: [number, number] = [t0, Math.min(t0 + (opts.spanSec ?? 86400), e.table.et1)];
  const step = opts.stepSec ?? 120;
  try {
    const halfAngle = fovHalfAngleRad(inst.fov.boresight, inst.fov.bounds);
    const times: number[] = [];
    const flags: boolean[] = [];
    // nadir mode never reads the Sun position; sample it only when sun-pointing to avoid
    // touching a body that may not be in the table.
    const ZERO: readonly [number, number, number] = [0, 0, 0];
    for (let t = span[0]; t <= span[1]; t += step) {
      const off = pointingOffAngleRad(
        pointing,
        positionAt(e.table, sc, t),
        positionAt(e.table, center, t),
        needsSun ? positionAt(e.table, 'Sun', t) : ZERO,
        positionAt(e.table, obsTarget, t),
      );
      times.push(t);
      flags.push(off <= halfAngle);
    }
    const fovOnly = intervalsFromFlags(times, flags);
    const pointingLabel = pointing === 'sun' ? 'Sun-pointed' : 'nadir-pointed';
    // Surviving window: the FOV-only window intersected with the assembled access stack, run
    // over the same span/step so the two read against the same geometry.
    const labelled = assembleConstraints(spec, center);
    const accessWindow = await computeAccess(e.spice, {
      observer: sc,
      target: obsTarget,
      span,
      step,
      constraints: labelled.map((l) => l.constraint),
    });
    const surviving = windowIntersect(fovOnly, accessWindow);
    if (!isDisposed()) {
      store.setState({
        fovResult: {
          window: fovOnly,
          span,
          label: `${inst.descriptor.name} sees ${obsTarget} (${pointingLabel})`,
          fom: fomOf(fovOnly, span),
        },
        fovSurviving: {
          window: surviving,
          span,
          label: `${inst.descriptor.name} sees ${obsTarget}, post-constraint`,
          fom: fomOf(surviving, span),
        },
      });
    }
  } catch (err) {
    if (!isDisposed()) store.setState({ fovResult: null, fovSurviving: null });
    console.error('in-FOV pointing analysis failed', err);
    throw err;
  }
}
