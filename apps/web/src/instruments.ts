// Instrument geometry, driven by a catalog-declared instrument: the sensor field
// of view (getfov) rendered as a cone toward the target, and its observation
// footprint on the target body via surface intercept (sincpt). The boresight is
// pointed nadir (spacecraft to target) unless a CK supplies real attitude. The
// observer, target, and frame come from the FootprintContext, so nothing here is
// mission-specific.
import type { SpiceEngine, Vec3 } from '@bessel/spice';
import type { Km3 } from '@bessel/scene';

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

/** Where an instrument points: the SPICE ids and body-fixed frame for footprints. */
export interface FootprintContext {
  /** Observer (the spacecraft) SPICE id, e.g. "-82". */
  readonly observerId: string;
  /** Target body SPICE id for getfov/sincpt, e.g. "699". */
  readonly targetId: string;
  /** Target body-fixed frame for sincpt, e.g. "IAU_SATURN". */
  readonly targetFrame: string;
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

// The cone is a bounded pointing indicator: extending it all the way to a target
// millions of km away makes it fill the view edge-on. Cap the length so it reads
// as a cone from the spacecraft; when the target is close the cap exceeds the
// range so the cone still reaches the surface near the footprint.
const FOV_CONE_MAX_KM = 350_000;

/** FOV cone rim points (km, heliocentric) emanating from the spacecraft toward Saturn. */
export function fovRim(spacecraftKm: Km3, saturnKm: Km3, fov: InstrumentFov): Km3[] {
  const sc = spacecraftKm as unknown as V3;
  const sat = saturnKm as unknown as V3;
  const frame = nadirFrame(sc, sat);
  const range = Math.hypot(sat[0] - sc[0], sat[1] - sc[1], sat[2] - sc[2]);
  const length = Math.min(range, FOV_CONE_MAX_KM);
  return fov.bounds.map((b) => {
    const ray = norm(toWorld(b, frame));
    return add(sc, scale(ray, length)) as Km3;
  });
}

/**
 * Observation footprint: intercept each FOV corner ray on the target body and
 * return the surface points in J2000 relative to the target centre (km), ready to
 * anchor at the target in the scene. Observer, target, and frame come from the
 * instrument context, so this works for any catalog-declared instrument.
 */
export async function footprint(
  spice: SpiceEngine,
  et: number,
  fov: InstrumentFov,
  ctx: FootprintContext,
): Promise<Km3[]> {
  // Point nadir using the real spacecraft-to-target direction at et, not the
  // interpolated table: near periapsis the spacecraft moves too fast for linear
  // interpolation to keep the boresight on the target.
  const dir = await spice.spkpos(ctx.targetId, et, 'J2000', 'NONE', ctx.observerId);
  const frame = frameFromZ(norm([dir.position.x, dir.position.y, dir.position.z]));
  const points: Km3[] = [];
  for (const b of fov.bounds) {
    const ray = norm(toWorld(b, frame));
    const hit = await spice.sincpt(
      'ELLIPSOID',
      ctx.targetId,
      et,
      ctx.targetFrame,
      'NONE',
      ctx.observerId,
      'J2000',
      { x: ray[0], y: ray[1], z: ray[2] },
    );
    if (!hit.found) return [];
    const rot = await spice.pxform(ctx.targetFrame, 'J2000', hit.trgepc);
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
