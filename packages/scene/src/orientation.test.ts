// Item 3 (CK attitude): applyAttitude orients an object by a SPICE row-major 3x3
// rotation, so a pxform(scFrame, J2000) result drives the spacecraft model.

import { describe, it, expect } from 'vitest';
import { Object3D, Vector3 } from 'three';
import { applyAttitude, rowMajor3x3ToMatrix4 } from './orientation.ts';

describe('applyAttitude', () => {
  it('leaves an object unrotated for the identity rotation', () => {
    const obj = new Object3D();
    applyAttitude(obj, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(obj.quaternion.x).toBeCloseTo(0, 6);
    expect(obj.quaternion.y).toBeCloseTo(0, 6);
    expect(obj.quaternion.z).toBeCloseTo(0, 6);
    expect(obj.quaternion.w).toBeCloseTo(1, 6);
  });

  it('rotates +x to +y for a 90 degree rotation about z', () => {
    const obj = new Object3D();
    // Row-major rotation of +90 degrees about z: x -> y, y -> -x.
    applyAttitude(obj, [0, -1, 0, 1, 0, 0, 0, 0, 1]);
    obj.updateMatrix();
    const v = new Vector3(1, 0, 0).applyQuaternion(obj.quaternion);
    expect(v.x).toBeCloseTo(0, 6);
    expect(v.y).toBeCloseTo(1, 6);
    expect(v.z).toBeCloseTo(0, 6);
  });

  it('matches the Matrix4 built from the same rotation', () => {
    const rot = [0, 0, 1, 0, 1, 0, -1, 0, 0];
    const obj = new Object3D();
    applyAttitude(obj, rot);
    const m = rowMajor3x3ToMatrix4(rot);
    const v1 = new Vector3(1, 2, 3).applyQuaternion(obj.quaternion);
    const v2 = new Vector3(1, 2, 3).applyMatrix4(m);
    expect(v1.x).toBeCloseTo(v2.x, 6);
    expect(v1.y).toBeCloseTo(v2.y, 6);
    expect(v1.z).toBeCloseTo(v2.z, 6);
  });
});
