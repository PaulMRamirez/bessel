// Phase 1 instrument geometry: the Cassini ISS field of view (getfov) rendered as
// a cone toward Saturn, and its observation footprint on Saturn via surface
// intercept (sincpt). Real attitude (CK) is a later phase; here the boresight is
// pointed nadir (spacecraft to Saturn) so the FOV and footprint are physical
// while staying within the committed kernel set.
import type { SpiceEngine, Vec3 } from '@bessel/spice';
import type { Km3 } from '@bessel/scene';

// The wide-angle camera (3.5 degrees) gives a legible cone and footprint; the
// narrow-angle camera (-82360) is a 0.35 degree pencil. Both come from getfov.
export const CASSINI_ISS_WAC = -82361;

type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V3): V3 => {
  const m = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / m, a[1] / m, a[2] / m];
};
const toV3 = (v: Vec3): V3 => [v.x, v.y, v.z];

export interface InstrumentFov {
  readonly boresight: V3;
  readonly bounds: readonly V3[];
}

export async function loadInstrumentFov(spice: SpiceEngine, instId: number): Promise<InstrumentFov> {
  const fov = await spice.getfov(instId);
  return { boresight: norm(toV3(fov.boresight)), bounds: fov.bounds.map((b) => toV3(b)) };
}

/** Build an orthonormal frame with the given +Z axis. */
function frameFromZ(z: V3): { x: V3; y: V3; z: V3 } {
  const ref: V3 = Math.abs(z[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  const x = norm(cross(ref, z));
  const y = cross(z, x);
  return { x, y, z };
}

/** Build an orthonormal frame whose +Z points from the spacecraft toward Saturn. */
function nadirFrame(spacecraft: V3, target: V3): { x: V3; y: V3; z: V3 } {
  return frameFromZ(norm(sub(target, spacecraft)));
}

/** Map an FOV vector (instrument frame, boresight = +Z) into the nadir world frame. */
function toWorld(v: V3, frame: { x: V3; y: V3; z: V3 }): V3 {
  return add(add(scale(frame.x, v[0]), scale(frame.y, v[1])), scale(frame.z, v[2]));
}

/** FOV cone rim points (km, heliocentric) reaching from the spacecraft to Saturn. */
export function fovRim(spacecraftKm: Km3, saturnKm: Km3, fov: InstrumentFov): Km3[] {
  const sc = spacecraftKm as unknown as V3;
  const sat = saturnKm as unknown as V3;
  const frame = nadirFrame(sc, sat);
  const length = Math.hypot(sat[0] - sc[0], sat[1] - sc[1], sat[2] - sc[2]);
  return fov.bounds.map((b) => {
    const ray = norm(toWorld(b, frame));
    return add(sc, scale(ray, length)) as Km3;
  });
}

/**
 * Observation footprint: intercept each FOV corner ray on Saturn (699) and return
 * the surface points in J2000 relative to Saturn's centre (km), ready to anchor at
 * Saturn in the scene.
 */
export async function footprint(
  spice: SpiceEngine,
  et: number,
  fov: InstrumentFov,
): Promise<Km3[]> {
  // Point nadir using the real Cassini-to-Saturn direction at et, not the
  // interpolated table: near periapsis the spacecraft moves too fast for linear
  // interpolation to keep the boresight on the target.
  const dir = await spice.spkpos('699', et, 'J2000', 'NONE', '-82');
  const frame = frameFromZ(norm([dir.position.x, dir.position.y, dir.position.z]));
  const points: Km3[] = [];
  for (const b of fov.bounds) {
    const ray = norm(toWorld(b, frame));
    const hit = await spice.sincpt(
      'ELLIPSOID',
      '699',
      et,
      'IAU_SATURN',
      'NONE',
      '-82',
      'J2000',
      { x: ray[0], y: ray[1], z: ray[2] },
    );
    if (!hit.found) return [];
    const rot = await spice.pxform('IAU_SATURN', 'J2000', hit.trgepc);
    const p = hit.point;
    // J2000 surface point relative to Saturn centre (row-major 3x3 times point).
    points.push([
      rot[0]! * p.x + rot[1]! * p.y + rot[2]! * p.z,
      rot[3]! * p.x + rot[4]! * p.y + rot[5]! * p.z,
      rot[6]! * p.x + rot[7]! * p.y + rot[8]! * p.z,
    ]);
  }
  return points;
}
