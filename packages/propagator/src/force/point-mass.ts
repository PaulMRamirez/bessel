// Point-mass (Keplerian) central gravity: a = -gm * r / |r|^3. With this term alone,
// the Cowell integrator must reproduce CSPICE prop2b to sub-meter (the primary
// self-contained validation oracle). (STK_PARITY_SPEC §4.2.)

import type { ForceContext, ForceTerm, Vector3 } from './types.ts';

export function pointMass(gm: number): ForceTerm {
  return {
    name: 'pointMass',
    acceleration(ctx: ForceContext): Vector3 {
      const [x, y, z] = ctx.r;
      const r2 = x * x + y * y + z * z;
      const r = Math.sqrt(r2);
      const k = -gm / (r2 * r); // -gm / r^3
      return [k * x, k * y, k * z];
    },
  };
}
