// Compose force terms into a force model: the acceleration is the vector sum of every
// term, evaluated in the central-body inertial frame. (STK_PARITY_SPEC §4.2.)

import type { ForceContext, ForceModel, ForceTerm, Vector3 } from './types.ts';

export function createForceModel(terms: readonly ForceTerm[]): ForceModel {
  return {
    terms,
    acceleration(ctx: ForceContext): Vector3 {
      let ax = 0;
      let ay = 0;
      let az = 0;
      for (const term of terms) {
        const a = term.acceleration(ctx);
        ax += a[0];
        ay += a[1];
        az += a[2];
      }
      return [ax, ay, az];
    },
  };
}
