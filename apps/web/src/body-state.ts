// Pure state-vector + osculating-element computation for the focused body, mirroring
// readouts.ts: a worker round-trip to spkezr (Cartesian state in a chosen frame) and
// oscelt (osculating elements about the center body), assembled into a BodyState the
// State panel renders. Returns null when the body is its own center or SPICE rejects,
// so the panel falls back to n/a rather than showing a wrong value.

import type { BodyState } from '@bessel/ui';
import type { SpiceEngine, CartesianState } from '@bessel/spice';

const RAD2DEG = 180 / Math.PI;

/** True anomaly (radians) from the mean anomaly and eccentricity. Elliptic uses a
 *  bounded Newton solve of Kepler's equation; hyperbolic uses its sinh form. */
function trueAnomaly(m0: number, ecc: number): number {
  if (ecc < 1) {
    let e = ecc < 0.8 ? m0 : Math.PI; // initial guess
    for (let i = 0; i < 32; i++) {
      const f = e - ecc * Math.sin(e) - m0;
      const fp = 1 - ecc * Math.cos(e);
      const d = f / fp;
      e -= d;
      if (Math.abs(d) < 1e-12) break;
    }
    return 2 * Math.atan2(Math.sqrt(1 + ecc) * Math.sin(e / 2), Math.sqrt(1 - ecc) * Math.cos(e / 2));
  }
  // Hyperbolic: M = ecc * sinh(H) - H.
  let h = m0;
  for (let i = 0; i < 64; i++) {
    const f = ecc * Math.sinh(h) - h - m0;
    const fp = ecc * Math.cosh(h) - 1;
    const d = f / fp;
    h -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return 2 * Math.atan2(Math.sqrt(ecc + 1) * Math.sinh(h / 2), Math.sqrt(ecc - 1) * Math.cosh(h / 2));
}

export async function computeBodyState(
  spice: SpiceEngine,
  target: string,
  center: string,
  frame: string,
  et: number,
  mu: number,
): Promise<BodyState | null> {
  // A body relative to itself has no state or orbit; the Sun about the Sun likewise.
  if (target === center) return null;
  let sv;
  try {
    sv = await spice.spkezr(target, et, frame, 'NONE', center);
  } catch {
    return null;
  }
  const state: CartesianState = { position: sv.position, velocity: sv.velocity };
  let elts;
  try {
    elts = await spice.oscelt(state, et, mu);
  } catch {
    return null;
  }
  const semiMajorKm = elts.ecc === 1 ? Infinity : elts.rp / (1 - elts.ecc);
  return {
    target,
    center,
    r: [sv.position.x, sv.position.y, sv.position.z],
    v: [sv.velocity.x, sv.velocity.y, sv.velocity.z],
    semiMajorKm,
    ecc: elts.ecc,
    incDeg: elts.inc * RAD2DEG,
    raanDeg: elts.lnode * RAD2DEG,
    argpDeg: elts.argp * RAD2DEG,
    trueAnomalyDeg: trueAnomaly(elts.m0, elts.ecc) * RAD2DEG,
  };
}
