// Geometric readouts computed via @bessel/spice: range (spkpos magnitude) and the
// solar phase, incidence, and emission angles at the sub-observer point (ilumin).
// Illumination needs a body-fixed frame and a shape, so it is attempted only for
// bodies that have one and falls back to nulls otherwise (no silent wrong values).
import type { Readouts } from '@bessel/ui';
import type { SpiceEngine } from '@bessel/spice';

const RAD2DEG = 180 / Math.PI;

/** Body-fixed frame for a body name, or null when none is expected. */
function bodyFrame(name: string): string | null {
  // The Sun is the light source: illumination angles on it are degenerate, so it
  // is omitted and its phase/incidence/emission readouts stay n/a.
  const frames: Record<string, string> = {
    Saturn: 'IAU_SATURN',
    Earth: 'IAU_EARTH',
    Mars: 'IAU_MARS',
    Jupiter: 'IAU_JUPITER',
    Venus: 'IAU_VENUS',
    Mercury: 'IAU_MERCURY',
  };
  return frames[name] ?? null;
}

export async function computeReadouts(
  spice: SpiceEngine,
  targetName: string,
  targetId: string,
  et: number,
  observer: string,
): Promise<Readouts> {
  const pos = await spice.spkpos(targetName, et, 'J2000', 'NONE', observer).catch(() => null);
  const rangeKm = pos ? Math.hypot(pos.position.x, pos.position.y, pos.position.z) : null;

  let phaseDeg: number | null = null;
  let incidenceDeg: number | null = null;
  let emissionDeg: number | null = null;
  const frame = bodyFrame(targetName);
  if (frame) {
    try {
      const sub = await spice.subpnt('NEAR POINT/ELLIPSOID', targetName, et, frame, 'NONE', observer);
      const ill = await spice.ilumin('ELLIPSOID', targetName, et, frame, 'NONE', observer, sub.point);
      phaseDeg = ill.phase * RAD2DEG;
      incidenceDeg = ill.incidence * RAD2DEG;
      emissionDeg = ill.emission * RAD2DEG;
    } catch {
      // Frame or shape unavailable for this body; leave the angles as n/a.
    }
  }
  void targetId;
  return { rangeKm, phaseDeg, incidenceDeg, emissionDeg };
}
