// @bessel/terrain: terrain-masked line-of-sight. A DEM gives surface height above
// the reference sphere; an LOS is clear only if no point along it dips below the
// terrain surface. Pure (the DEM is a height function). This serves terrain-masked
// access; surface visualization is an MMGIS handoff. (STK_PARITY_SPEC §4.12.)

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A digital elevation model: height (m) above the reference sphere at a location. */
export interface Dem {
  heightAt(lonRad: number, latRad: number): number;
}

const mag = (a: Vec3): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);

/** Body-fixed rectangular point (km) -> spherical lon/lat (rad) and radius (km). */
function toSpherical(p: Vec3): { lon: number; lat: number; r: number } {
  const r = mag(p);
  return { lon: Math.atan2(p.y, p.x), lat: r > 0 ? Math.asin(p.z / r) : 0, r };
}

/**
 * Is the straight line from `observer` to `target` (body-fixed km) clear of the
 * terrain? Samples the ray; the LOS is blocked if any interior point's radius drops
 * below the local surface (bodyRadiusKm + DEM height). Returns true when clear.
 */
export function terrainMaskedLos(
  observer: Vec3,
  target: Vec3,
  dem: Dem,
  bodyRadiusKm: number,
  samples = 256,
): boolean {
  const dx = target.x - observer.x;
  const dy = target.y - observer.y;
  const dz = target.z - observer.z;
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const p: Vec3 = { x: observer.x + dx * t, y: observer.y + dy * t, z: observer.z + dz * t };
    const { lon, lat, r } = toSpherical(p);
    const surface = bodyRadiusKm + dem.heightAt(lon, lat) / 1000;
    if (r < surface) return false; // the LOS passes below the terrain surface
  }
  return true;
}

/** A flat DEM (everywhere at the reference sphere): models curvature-only masking. */
export const FLAT_DEM: Dem = { heightAt: () => 0 };
