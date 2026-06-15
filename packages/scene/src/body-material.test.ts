// Item 2 (rendering fidelity): a body with an image base-map renders with that
// image; without one it uses the procedural fallback. The choice and material
// assembly are tested with injected loaders so no WebGL or DOM is needed.

import { describe, it, expect } from 'vitest';
import { Texture } from 'three';
import { chooseBodyTextureSource, buildBodyMaterial } from './body-material.ts';
import type { PlanetDef } from './planets.ts';

const PLAIN: PlanetDef = { name: 'Mars', spiceId: '4', radiusKm: 3390, color: [0.7, 0.4, 0.25] };
const TEXTURED: PlanetDef = { ...PLAIN, texture: 'mars.jpg', normalMap: 'mars_normal.jpg' };

describe('chooseBodyTextureSource', () => {
  it('prefers an image map when the body declares a texture', () => {
    expect(chooseBodyTextureSource(TEXTURED)).toEqual({ kind: 'image', url: 'mars.jpg' });
  });

  it('falls back to procedural without a texture', () => {
    expect(chooseBodyTextureSource(PLAIN)).toEqual({ kind: 'procedural' });
  });
});

describe('buildBodyMaterial', () => {
  it('uses the procedural texture and never calls the image loader for a plain body', () => {
    const procedural = new Texture();
    let imageCalls = 0;
    const material = buildBodyMaterial(PLAIN, {
      loadImageTexture: () => {
        imageCalls += 1;
        return new Texture();
      },
      proceduralTexture: () => procedural,
    });
    expect(material.map).toBe(procedural);
    expect(imageCalls).toBe(0);
    expect(material.normalMap).toBeNull();
  });

  it('loads the image base-map and normal map when present', () => {
    const byUrl = new Map<string, Texture>();
    const material = buildBodyMaterial(TEXTURED, {
      loadImageTexture: (url) => {
        const t = new Texture();
        byUrl.set(url, t);
        return t;
      },
      proceduralTexture: () => new Texture(),
    });
    expect(material.map).toBe(byUrl.get('mars.jpg'));
    expect(material.normalMap).toBe(byUrl.get('mars_normal.jpg'));
  });
});
