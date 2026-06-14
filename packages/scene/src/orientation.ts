// Shared orientation helper: convert a SPICE row-major 3x3 rotation (pxform) into
// a three.js Matrix4 (column-major). Used by DSK meshes, axis triads, and rings.

import { Matrix4 } from 'three';

/** Convert a row-major 3x3 (SPICE pxform) to a three.js Matrix4. */
export function rowMajor3x3ToMatrix4(m: readonly number[]): Matrix4 {
  // three.js Matrix4.set takes row-major arguments, so pass the 3x3 directly into
  // the upper-left block with a 1 in the lower-right.
  return new Matrix4().set(
    m[0]!, m[1]!, m[2]!, 0,
    m[3]!, m[4]!, m[5]!, 0,
    m[6]!, m[7]!, m[8]!, 0,
    0, 0, 0, 1,
  );
}
