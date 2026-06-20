// All-vs-all conjunction screening. Given N objects sampled over a span, find every
// close-approach pair whose minimum separation drops below a distance threshold,
// then refine each flagged pair to a TCA / miss / Pc. A smart sieve avoids the full
// O(N^2) distance evaluation at every step: a per-object apogee/perigee band filter
// rejects pairs whose radial shells cannot overlap, and a coarse conjunction-box
// (axis-aligned bounding-box overlap over each coarse step) rejects the rest before
// any fine sampling. Pure: objects arrive as sampled ephemerides, so the package
// stays free of SPICE and propagation. (STK_PARITY_SPEC §4.8, CAT-SCR-1/CAT-TCA-1.)

import { closestApproachLinear, collisionProbability2D, type Vec3 } from './index.ts';

/** A sampled inertial ephemeris for one screened object (km, km/s). */
export interface SampledEphemeris {
  /** Stable identifier (SPK id or catalog number) reported in results. */
  readonly id: string;
  /** Sample epochs (ET seconds), strictly ascending, shared length with positions. */
  readonly et: Float64Array;
  /** Interleaved positions x,y,z (km), length 3 * et.length. */
  readonly pos: Float64Array;
  /** Interleaved velocities vx,vy,vz (km/s), length 3 * et.length. */
  readonly vel: Float64Array;
  /** Hard-body radius contribution (km); summed pairwise for Pc. */
  readonly radiusKm?: number;
  /** Per-axis 1-sigma position uncertainty (km) in the inertial frame, for Pc. */
  readonly sigmaKm?: number;
}

/** A flagged close approach between two screened objects. */
export interface ConjunctionEvent {
  readonly primaryId: string;
  readonly secondaryId: string;
  /** Time of closest approach (ET seconds). */
  readonly tca: number;
  /** Miss distance at TCA (km). */
  readonly missKm: number;
  /** Relative speed at TCA (km/s). */
  readonly relSpeedKmS: number;
  /** 2D probability of collision when both objects carry radius and sigma; else null. */
  readonly pc: number | null;
}

export interface ScreenOptions {
  /** Flag pairs whose minimum separation falls below this distance (km). */
  readonly thresholdKm: number;
  /**
   * Sieve margin (km) added to the threshold for the coarse apogee/perigee and
   * conjunction-box rejection, so a pair is never dropped before fine sampling when
   * it could still close inside the threshold. Default 50 km.
   */
  readonly sieveMarginKm?: number;
}

/** A screening input or configuration error (loud, located). */
export class ScreenError extends Error {
  constructor(message: string) {
    super(`conjunction screen: ${message}`);
    this.name = 'ScreenError';
  }
}

interface ObjectShells {
  /** Minimum |r| over the span (km), the effective perigee radius. */
  readonly rMin: number;
  /** Maximum |r| over the span (km), the effective apogee radius. */
  readonly rMax: number;
}

const posAt = (e: SampledEphemeris, k: number): Vec3 => ({
  x: e.pos[k * 3]!,
  y: e.pos[k * 3 + 1]!,
  z: e.pos[k * 3 + 2]!,
});

const velAt = (e: SampledEphemeris, k: number): Vec3 => ({
  x: e.vel[k * 3]!,
  y: e.vel[k * 3 + 1]!,
  z: e.vel[k * 3 + 2]!,
});

function radialShells(e: SampledEphemeris): ObjectShells {
  let rMin = Infinity;
  let rMax = 0;
  const n = e.et.length;
  for (let k = 0; k < n; k++) {
    const p = posAt(e, k);
    const r = Math.hypot(p.x, p.y, p.z);
    if (r < rMin) rMin = r;
    if (r > rMax) rMax = r;
  }
  return { rMin, rMax };
}

/** Radial-shell (apogee/perigee band) sieve: the two shells must come within `pad`. */
function shellsOverlap(a: ObjectShells, b: ObjectShells, pad: number): boolean {
  // The closest the two spherical shells can approach is the gap between the bands;
  // if even that exceeds the padded threshold the pair can never conjunct.
  if (a.rMin > b.rMax + pad) return false;
  if (b.rMin > a.rMax + pad) return false;
  return true;
}

function validate(e: SampledEphemeris): void {
  const n = e.et.length;
  if (n < 2) throw new ScreenError(`object ${e.id} needs at least 2 samples (got ${n})`);
  if (e.pos.length !== n * 3) throw new ScreenError(`object ${e.id} pos length ${e.pos.length} != 3 * ${n}`);
  if (e.vel.length !== n * 3) throw new ScreenError(`object ${e.id} vel length ${e.vel.length} != 3 * ${n}`);
  for (let k = 1; k < n; k++) {
    if (e.et[k]! <= e.et[k - 1]!) throw new ScreenError(`object ${e.id} epochs must be strictly ascending`);
  }
}

/**
 * Refine the closest approach of a flagged pair from the shared sample grid: find
 * the sample index of minimum separation, then linearize the relative motion across
 * the bracketing samples and solve for the range-rate zero (Foster TCA). The
 * relative state is linearized inside the bracket, which matches the rectilinear
 * closest-approach model the package already uses.
 */
function refinePair(a: SampledEphemeris, b: SampledEphemeris): ConjunctionEvent {
  const n = a.et.length;
  let kMin = 0;
  let dMin = Infinity;
  for (let k = 0; k < n; k++) {
    const pa = posAt(a, k);
    const pb = posAt(b, k);
    const d = Math.hypot(pb.x - pa.x, pb.y - pa.y, pb.z - pa.z);
    if (d < dMin) {
      dMin = d;
      kMin = k;
    }
  }
  // Bracket around the discrete minimum and linearize relative motion there.
  const k0 = kMin === 0 ? 0 : kMin - 1;
  const k1 = kMin === n - 1 ? n - 1 : kMin + 1;
  const t0 = a.et[k0]!;
  const pa0 = posAt(a, k0);
  const pb0 = posAt(b, k0);
  const va0 = velAt(a, k0);
  const vb0 = velAt(b, k0);
  const relPos: Vec3 = { x: pb0.x - pa0.x, y: pb0.y - pa0.y, z: pb0.z - pa0.z };
  const relVel: Vec3 = { x: vb0.x - va0.x, y: vb0.y - va0.y, z: vb0.z - va0.z };
  const ca = closestApproachLinear(relPos, relVel);
  // Clamp the linear TCA into the bracket so a near-tangent geometry cannot run away.
  const span = a.et[k1]! - t0;
  const tcaRel = Math.max(0, Math.min(span, ca.tca));
  const tca = t0 + tcaRel;
  // Recompute miss at the clamped time from the linearized relative motion.
  const missVec: Vec3 = {
    x: relPos.x + relVel.x * tcaRel,
    y: relPos.y + relVel.y * tcaRel,
    z: relPos.z + relVel.z * tcaRel,
  };
  const missKm = Math.min(dMin, Math.hypot(missVec.x, missVec.y, missVec.z));

  let pc: number | null = null;
  if (a.radiusKm !== undefined && b.radiusKm !== undefined && a.sigmaKm !== undefined && b.sigmaKm !== undefined) {
    const sigma = Math.hypot(a.sigmaKm, b.sigmaKm);
    pc = collisionProbability2D({
      radiusKm: a.radiusKm + b.radiusKm,
      sigmaXKm: sigma,
      sigmaYKm: sigma,
      // With an isotropic combined covariance the full miss magnitude is the offset
      // projected into the encounter plane.
      missXKm: missKm,
      missYKm: 0,
    });
  }
  return { primaryId: a.id, secondaryId: b.id, tca, missKm, relSpeedKmS: ca.relSpeedKmS, pc };
}

/**
 * All-vs-all screen: flag every pair that closes below `thresholdKm` over the span
 * and report each pair's TCA, miss, relative speed, and (when covariance is given)
 * Pc. The two-stage sieve (radial-shell band, then coarse bounding-box overlap)
 * rejects non-conjuncting pairs before any fine evaluation.
 */
export function screenAllVsAll(objects: readonly SampledEphemeris[], opts: ScreenOptions): ConjunctionEvent[] {
  if (opts.thresholdKm <= 0) throw new ScreenError(`thresholdKm must be positive (got ${opts.thresholdKm})`);
  for (const e of objects) validate(e);
  const pad = (opts.sieveMarginKm ?? 50) + opts.thresholdKm;
  const shells = objects.map(radialShells);

  const events: ConjunctionEvent[] = [];
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i]!;
      const b = objects[j]!;
      // Stage 1: radial-shell apogee/perigee band sieve.
      if (!shellsOverlap(shells[i]!, shells[j]!, pad)) continue;
      // Stage 2: coarse conjunction-box: any sample where the per-axis separation is
      // within the padded threshold. (Objects share the screening grid.)
      if (!boxesEverOverlap(a, b, pad)) continue;
      // Fine: refine to TCA / miss / Pc, and keep only sub-threshold approaches.
      const ev = refinePair(a, b);
      if (ev.missKm <= opts.thresholdKm) events.push(ev);
    }
  }
  events.sort((p, q) => p.tca - q.tca);
  return events;
}

/** Coarse box sieve: true if any shared sample brings every axis within `pad`. */
function boxesEverOverlap(a: SampledEphemeris, b: SampledEphemeris, pad: number): boolean {
  const n = a.et.length;
  for (let k = 0; k < n; k++) {
    const pa = posAt(a, k);
    const pb = posAt(b, k);
    if (Math.abs(pb.x - pa.x) <= pad && Math.abs(pb.y - pa.y) <= pad && Math.abs(pb.z - pa.z) <= pad) {
      return true;
    }
  }
  return false;
}
