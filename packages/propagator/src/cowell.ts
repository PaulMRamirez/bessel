// The Cowell propagator entry point: numerically integrate a Cartesian state under a
// force model and return the same EphemerisTable shape the analytic propagators
// produce, so the arc flows into publishEphemeris -> writeSpkType13 -> spkpos with no
// special path. Pure and synchronous: the force model's terms are already resolved,
// so this needs no SPICE. (STK_PARITY_SPEC §4.2.)

import type { CartesianState } from '@bessel/spice';
import { emptyTable, type EphemerisTable } from './elements.ts';
import { integrate, type IntegratorOptions, type Rhs } from './integrator.ts';
import type { ForceModel } from './force/types.ts';

export interface CowellOptions {
  /** Initial Cartesian state (km, km/s) in `frame`, central-body-centered. */
  readonly state: CartesianState;
  /** ET of the initial state. */
  readonly epoch: number;
  /** Output epochs (ascending, all >= epoch). */
  readonly etGrid: Float64Array;
  /** The (synchronous) force model summing every perturbation. */
  readonly forceModel: ForceModel;
  /** Inertial frame label stored on the table (default 'J2000'). */
  readonly frame?: string;
  readonly tolerances?: IntegratorOptions;
}

/**
 * Cowell special-perturbations propagation: integrate the state over `etGrid` under
 * `forceModel`, returning a column EphemerisTable. The force model's acceleration is
 * evaluated as dy/dt = [v, a(t, r, v)].
 */
export function propagateCowell(opts: CowellOptions): EphemerisTable {
  const { state, epoch, etGrid, forceModel } = opts;
  const frame = opts.frame ?? 'J2000';

  const y0 = Float64Array.of(
    state.position.x,
    state.position.y,
    state.position.z,
    state.velocity.x,
    state.velocity.y,
    state.velocity.z,
  );

  const rhs: Rhs = (t, y, dy) => {
    const a = forceModel.acceleration({
      et: t,
      r: [y[0]!, y[1]!, y[2]!],
      v: [y[3]!, y[4]!, y[5]!],
    });
    dy[0] = y[3]!;
    dy[1] = y[4]!;
    dy[2] = y[5]!;
    dy[3] = a[0];
    dy[4] = a[1];
    dy[5] = a[2];
  };

  const states = integrate(rhs, y0, epoch, etGrid, opts.tolerances);

  const n = etGrid.length;
  const table = emptyTable(frame, etGrid);
  for (let k = 0; k < n; k++) {
    const s = states[k]!;
    (table.x as Float64Array)[k] = s[0]!;
    (table.y as Float64Array)[k] = s[1]!;
    (table.z as Float64Array)[k] = s[2]!;
    (table.vx as Float64Array)[k] = s[3]!;
    (table.vy as Float64Array)[k] = s[4]!;
    (table.vz as Float64Array)[k] = s[5]!;
  }
  return table;
}
