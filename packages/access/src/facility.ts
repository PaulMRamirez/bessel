// Ground-facility access by elevation. The facility's body-fixed position and local
// vertical come from its geodetic coordinates (pure ellipsoid math); the target's
// elevation is sampled in the body-fixed frame and the in-view window is found by
// sampling + bisection (the native geometry-finder for this derived constraint).
// (STK_PARITY_SPEC §4.3, ACC-5.)

import type { AberrationCorrection, SpiceEngine, Vec3 } from '@bessel/spice';
import { findConstraintWindow, type EphemerisTime, type Window } from '@bessel/timeline';

export interface Facility {
  /** Central body (e.g. "EARTH") whose body-fixed frame the facility sits in. */
  readonly body: string;
  /** Body-fixed frame (e.g. "IAU_EARTH"). */
  readonly bodyFrame: string;
  readonly lonRad: number;
  readonly latRad: number;
  readonly altKm: number;
}

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const unit = (a: Vec3): Vec3 => {
  const m = Math.sqrt(dot(a, a)) || 1;
  return { x: a.x / m, y: a.y / m, z: a.z / m };
};

/** Geodetic (lon, lat, alt) to body-fixed rectangular (km) on an ellipsoid. */
function geodeticToRect(fac: Facility, re: number, f: number): Vec3 {
  const e2 = f * (2 - f);
  const sLat = Math.sin(fac.latRad);
  const cLat = Math.cos(fac.latRad);
  const n = re / Math.sqrt(1 - e2 * sLat * sLat);
  return {
    x: (n + fac.altKm) * cLat * Math.cos(fac.lonRad),
    y: (n + fac.altKm) * cLat * Math.sin(fac.lonRad),
    z: (n * (1 - e2) + fac.altKm) * sLat,
  };
}

/** Outward geodetic normal (local up) at the facility, in the body-fixed frame. */
function geodeticNormal(fac: Facility): Vec3 {
  const cLat = Math.cos(fac.latRad);
  return { x: cLat * Math.cos(fac.lonRad), y: cLat * Math.sin(fac.lonRad), z: Math.sin(fac.latRad) };
}

/**
 * Compute the intervals over [start, stop] during which `target` is at or above
 * `minElevationRad` as seen from the facility. Elevation is the angle of the
 * line-of-sight above the local horizon (geodetic normal).
 */
export async function computeElevationAccess(
  spice: SpiceEngine,
  facility: Facility,
  target: string,
  span: readonly [EphemerisTime, EphemerisTime],
  step: number,
  minElevationRad: number,
  abcorr: AberrationCorrection = 'NONE',
): Promise<Window> {
  const radii = await spice.bodvrd(facility.body, 'RADII');
  const re = radii[0]!;
  const rp = radii[2]!;
  const facPos = geodeticToRect(facility, re, (re - rp) / re);
  const up = geodeticNormal(facility);

  // g(et) = elevation - minElevation; access is where g >= 0. The shared geometry
  // finder scans and refines the crossings.
  const g = async (et: number): Promise<number> => {
    const t = await spice.spkpos(target, et, facility.bodyFrame, abcorr, facility.body);
    const los = unit(sub(t.position, facPos));
    return Math.asin(Math.max(-1, Math.min(1, dot(los, up)))) - minElevationRad;
  };
  return findConstraintWindow(g, span, step);
}
