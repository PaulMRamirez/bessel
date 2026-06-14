// Camera mode math. Orbit and center are spherical; track places the camera
// behind the focus velocity looking down-track. Pure so it is unit tested.

import { type Km3 } from './geometry-builders.ts';

export type CameraMode = 'orbit' | 'center' | 'track';

/**
 * Track camera position (scene units, relative to the focus at the origin): behind
 * the velocity direction, raised by elevationBias. Returns a safe default when the
 * velocity is near zero.
 */
export function computeTrackCameraPosition(
  velocityKm: Km3,
  distance: number,
  elevationBias = 0.3,
): [number, number, number] {
  const m = Math.hypot(velocityKm[0], velocityKm[1], velocityKm[2]);
  if (m < 1e-9) return [distance, distance * elevationBias, 0];
  const vx = velocityKm[0] / m;
  const vy = velocityKm[1] / m;
  const vz = velocityKm[2] / m;
  // Behind the velocity (minus v-hat), lifted along +Y.
  const back: [number, number, number] = [-vx, -vy + elevationBias, -vz];
  const bm = Math.hypot(back[0], back[1], back[2]) || 1;
  return [(back[0] / bm) * distance, (back[1] / bm) * distance, (back[2] / bm) * distance];
}

/** Spherical orbit position from azimuth, elevation, distance (scene units). */
export function computeOrbitCameraPosition(
  azimuth: number,
  elevation: number,
  distance: number,
): [number, number, number] {
  const ce = Math.cos(elevation);
  return [
    distance * ce * Math.cos(azimuth),
    distance * Math.sin(elevation),
    distance * ce * Math.sin(azimuth),
  ];
}
