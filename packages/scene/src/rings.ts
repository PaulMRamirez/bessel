// Planetary ring geometry (Saturn). An annulus in the body equatorial plane with
// radial UVs so a banded texture maps along the radius. Pure builders so the
// vertex math is unit tested headlessly; the scene wraps it in a mesh.

import {
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  RGBAFormat,
} from 'three';
import { SCALE } from './geometry-builders.ts';

export interface RingVertices {
  readonly positions: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: number[];
}

/** Build an annulus (inner..outer km) in the XY plane, segments around. */
export function buildRingVertices(
  innerRadiusKm: number,
  outerRadiusKm: number,
  segments = 96,
  scale = SCALE,
): RingVertices {
  const inner = innerRadiusKm * scale;
  const outer = outerRadiusKm * scale;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    positions.push(inner * cos, inner * sin, 0, outer * cos, outer * sin, 0);
    // U spans the radius (0 inner, 1 outer) so a banded texture reads radially.
    uvs.push(0, i / segments, 1, i / segments);
    if (i < segments) {
      const b = i * 2;
      indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    indices,
  };
}

function bandedRingTexture(color: readonly [number, number, number]): DataTexture {
  const w = 64;
  const data = new Uint8Array(w * 4);
  for (let x = 0; x < w; x++) {
    const band = 0.5 + 0.5 * Math.sin(x * 0.7) * Math.cos(x * 0.21);
    const i = x * 4;
    data[i] = color[0] * 255 * (0.6 + 0.4 * band);
    data[i + 1] = color[1] * 255 * (0.6 + 0.4 * band);
    data[i + 2] = color[2] * 255 * (0.6 + 0.4 * band);
    data[i + 3] = 200 * (0.4 + 0.6 * band);
  }
  const tex = new DataTexture(data, w, 1, RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

/** Build a ring mesh (translucent, double-sided, banded) for a planet. */
export function buildRingMesh(
  innerRadiusKm: number,
  outerRadiusKm: number,
  color: readonly [number, number, number] = [0.86, 0.8, 0.66],
): Mesh {
  const v = buildRingVertices(innerRadiusKm, outerRadiusKm);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(v.positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(v.uvs, 2));
  geometry.setIndex(v.indices);
  geometry.computeVertexNormals();
  const material = new MeshBasicMaterial({
    map: bandedRingTexture(color),
    color: new Color(1, 1, 1),
    transparent: true,
    opacity: 0.85,
    side: DoubleSide,
    depthWrite: false,
  });
  return new Mesh(geometry, material);
}
