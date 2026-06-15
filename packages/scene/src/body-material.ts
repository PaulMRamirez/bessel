// Body globe materials. Item 2 (rendering fidelity): a body can carry an image
// base-map (and normal map) URL and render with real textures; without one it
// falls back to the procedural latitude-banded texture so globes always read as
// surfaces. The texture choice and material assembly are split out here so they
// are unit-testable with injected loaders (no WebGL or DOM needed).

import { Color, DataTexture, MeshStandardMaterial, RGBAFormat, type Texture } from 'three';
import type { PlanetDef } from './planets.ts';

/** Procedural latitude-banded texture from a base color (no image assets). */
export function proceduralBodyTexture(color: readonly [number, number, number]): DataTexture {
  const w = 32;
  const h = 16;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const band = 0.85 + 0.15 * Math.sin((y / h) * Math.PI * 6);
      const lon = 0.92 + 0.08 * Math.sin((x / w) * Math.PI * 4);
      const k = band * lon;
      const i = (y * w + x) * 4;
      data[i] = Math.min(255, color[0] * 255 * k);
      data[i + 1] = Math.min(255, color[1] * 255 * k);
      data[i + 2] = Math.min(255, color[2] * 255 * k);
      data[i + 3] = 255;
    }
  }
  const tex = new DataTexture(data, w, h, RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

export type BodyTextureSource =
  | { readonly kind: 'image'; readonly url: string }
  | { readonly kind: 'procedural' };

/** An image base-map wins when the body declares one; otherwise procedural. */
export function chooseBodyTextureSource(def: PlanetDef): BodyTextureSource {
  return def.texture ? { kind: 'image', url: def.texture } : { kind: 'procedural' };
}

export interface BodyMaterialDeps {
  /** Load an image texture from a URL (real: TextureLoader; tests: a stub). */
  readonly loadImageTexture: (url: string) => Texture;
  /** Build the procedural fallback texture from a color. */
  readonly proceduralTexture: (color: readonly [number, number, number]) => Texture;
}

/** Build a body globe material, using an image base-map when the body has one. */
export function buildBodyMaterial(def: PlanetDef, deps: BodyMaterialDeps): MeshStandardMaterial {
  const source = chooseBodyTextureSource(def);
  const map =
    source.kind === 'image' ? deps.loadImageTexture(source.url) : deps.proceduralTexture(def.color);
  const material = new MeshStandardMaterial({
    map,
    emissive: new Color(def.color[0], def.color[1], def.color[2]),
    emissiveIntensity: def.name === 'Sun' ? 0.9 : 0.08,
    roughness: 0.9,
    metalness: 0.0,
  });
  if (def.normalMap) material.normalMap = deps.loadImageTexture(def.normalMap);
  return material;
}
