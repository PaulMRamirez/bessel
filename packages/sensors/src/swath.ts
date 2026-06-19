// Typed sensor schema and time-evolving swath accumulation: sample a sensor's
// footprint along a trajectory and accumulate the boundary rings (for rendering) and
// the covered region (for a coverage metric). Builds on the pure FOV/footprint
// geometry. (STK_PARITY_SPEC §4.7.)

import { footprintOnSphere, pointInConicFov, type Vec3 } from './index.ts';

/** A typed sensor definition. Conic (circular FOV) for now; rectangular can extend this. */
export interface SensorSchema {
  readonly name: string;
  readonly kind: 'conic';
  /** Circular field-of-view half-angle (rad). */
  readonly halfAngleRad: number;
}

/** One sample along the trajectory: the sensor apex and its boresight direction. */
export interface SwathSample {
  readonly apex: Vec3;
  readonly boresight: Vec3;
}

export interface Swath {
  /** One footprint boundary ring (surface points) per sample. */
  readonly rings: Vec3[][];
  /** Every surface boundary point, flattened (for a swath ribbon / point cloud). */
  readonly points: Vec3[];
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

/**
 * Accumulate the sensor footprint over a sequence of samples on a sphere: the per-
 * sample boundary rings and their flattened points.
 */
export function accumulateSwath(
  samples: readonly SwathSample[],
  schema: SensorSchema,
  center: Vec3,
  radius: number,
  ringSamples = 32,
): Swath {
  const rings = samples.map(
    (s) => footprintOnSphere(s.apex, s.boresight, schema.halfAngleRad, center, radius, ringSamples).points,
  );
  return { rings, points: rings.flat() };
}

/** Whether any sample's FOV cone contains the line of sight to `point`. */
export function swathCovers(point: Vec3, samples: readonly SwathSample[], schema: SensorSchema): boolean {
  return samples.some((s) => pointInConicFov(sub(point, s.apex), s.boresight, schema.halfAngleRad));
}

/** Fraction of `testPoints` covered by the swath at any sample (a coverage metric). */
export function swathCoverageFraction(
  testPoints: readonly Vec3[],
  samples: readonly SwathSample[],
  schema: SensorSchema,
): number {
  if (testPoints.length === 0) return 0;
  let covered = 0;
  for (const p of testPoints) if (swathCovers(p, samples, schema)) covered += 1;
  return covered / testPoints.length;
}
