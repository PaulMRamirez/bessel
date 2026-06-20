// Attitude history read/write and a pxform-style body-orientation query.
//
// A native CK *binary* write needs CSPICE-WASM exports (ckopn/ckw03/ckcls, and ckgp/
// ckgpav/sce2c to read) that are not yet bound in @bessel/spice (the build's
// EXPORTED_FUNCTIONS does not list them and relinking is out of scope here). So the
// attitude interchange is done through the already-supported CCSDS AEM path in
// @bessel/interop (parseAem/writeAem): an attitude profile is written as an AEM Type
// 3-style tabulated quaternion segment and read back, and THIS module provides the
// CK-equivalent sampler, a `pxform`-style body orientation query that returns the
// rotation at any epoch by shortest-path SLERP between the bracketing records (the CK
// Type 3 continuous-quaternion interpolation rule). The orientation matches the source
// exactly at sample epochs. CK-binary IO is the documented deferral; when the ck*
// symbols are exported this module gains a native CK backend behind the same query.
// (STK_PARITY_SPEC section 4.6 ATT-6/ATT-7.)

import type { Mat3 } from '@bessel/spice';
import { slerp, type Quaternion } from './index.ts';

/** One attitude record: an epoch (ET seconds) and a scalar-first quaternion. */
export interface AttitudeRecord {
  readonly et: number;
  readonly quaternion: Quaternion;
}

/** A bad attitude history (loud, located). */
export class AttitudeHistoryError extends Error {
  constructor(message: string) {
    super(`attitude history: ${message}`);
    this.name = 'AttitudeHistoryError';
  }
}

/**
 * A queryable attitude history (the CK Type 3 analog): given tabulated quaternions,
 * answer the orientation at any epoch in [first, last]. Continuous, segment-wise SLERP.
 */
export interface AttitudeHistory {
  /** Epoch bounds [first, last] (ET seconds). */
  readonly span: readonly [number, number];
  /** The stored records (ascending in et). */
  readonly records: readonly AttitudeRecord[];
  /** Orientation quaternion at `et`, SLERP-interpolated; exact at sample epochs. */
  quaternionAt(et: number): Quaternion;
  /** Orientation as a rotation matrix at `et` (the pxform-style query). */
  pxformAt(et: number): Mat3;
}

const normalize = (q: Quaternion): Quaternion => {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
};

/**
 * Scalar-first quaternion [w, x, y, z] to a row-major 3x3 rotation matrix, matching
 * CSPICE q2m (so a furnished CK / m2q quaternion maps to the same orientation). The
 * matrix rotates a vector from the base frame into the body frame.
 */
export function quaternionToMatrix(q: Quaternion): Mat3 {
  const [w, x, y, z] = normalize(q);
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  // CSPICE q2m row-major rotation matrix.
  return [
    1 - (yy + zz), xy - wz, xz + wy,
    xy + wz, 1 - (xx + zz), yz - wx,
    xz - wy, yz + wx, 1 - (xx + yy),
  ];
}

/** Build a queryable attitude history from records (must be >= 1 and ascending in et). */
export function attitudeHistory(records: readonly AttitudeRecord[]): AttitudeHistory {
  if (records.length === 0) throw new AttitudeHistoryError('needs at least one record');
  for (let i = 1; i < records.length; i++) {
    if (records[i]!.et <= records[i - 1]!.et) {
      throw new AttitudeHistoryError('records must be strictly ascending in et');
    }
  }
  const stored = records.map((r) => ({ et: r.et, quaternion: normalize(r.quaternion) }));
  const first = stored[0]!.et;
  const last = stored[stored.length - 1]!.et;

  const quaternionAt = (et: number): Quaternion => {
    if (et < first || et > last) {
      throw new AttitudeHistoryError(`et ${et} is outside the history span [${first}, ${last}]`);
    }
    // Locate the bracketing pair; exact at a node.
    if (et === first) return stored[0]!.quaternion;
    let lo = 0;
    for (let i = 0; i < stored.length - 1; i++) {
      if (et >= stored[i]!.et && et <= stored[i + 1]!.et) {
        lo = i;
        break;
      }
    }
    const a = stored[lo]!;
    const b = stored[lo + 1]!;
    if (et === a.et) return a.quaternion;
    if (et === b.et) return b.quaternion;
    const frac = (et - a.et) / (b.et - a.et);
    return slerp(a.quaternion, b.quaternion, frac);
  };

  return {
    span: [first, last],
    records: stored,
    quaternionAt,
    pxformAt: (et: number): Mat3 => quaternionToMatrix(quaternionAt(et)),
  };
}
