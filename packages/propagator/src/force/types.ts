// The pluggable force model for the Cowell propagator. Terms are SYNCHRONOUS: any
// SPICE I/O (third-body positions, body-fixed rotations) is resolved once, up front,
// into sync closures, so the integrator's inner loop never awaits. Terms are additive
// and independently testable. (STK_PARITY_SPEC §4.2.)

export type Vector3 = readonly [number, number, number];

/** The instantaneous state handed to each force term (central-body-centered, inertial). */
export interface ForceContext {
  /** Absolute ET seconds (for time-dependent terms, e.g. third-body interpolation). */
  readonly et: number;
  /** Position (km). */
  readonly r: Vector3;
  /** Velocity (km/s). */
  readonly v: Vector3;
}

export interface ForceTerm {
  /** Provenance label, e.g. "pointMass", "zonal", "thirdBody:SUN". */
  readonly name: string;
  /** Acceleration contribution (km/s^2). */
  acceleration(ctx: ForceContext): Vector3;
  // partials?(ctx): readonly number[]; // RESERVED for STM / variational propagation.
}

export interface ForceModel {
  readonly terms: readonly ForceTerm[];
  /** Sum of every term's acceleration (km/s^2). */
  acceleration(ctx: ForceContext): Vector3;
}
