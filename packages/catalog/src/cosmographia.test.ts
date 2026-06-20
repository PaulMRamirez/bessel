// Texture-fidelity parity (ADR-0006): a Cosmographia Globe declaring baseMap /
// cloudMap / specularColor round-trips into the native Globe with texture /
// cloudMap / specularColor, and a RingSystem maps its radii + texture.

import { describe, it, expect } from 'vitest';
import { cosmographiaGeometryToNative } from './cosmographia.ts';
import { CatalogError } from './index.ts';

describe('cosmographiaGeometryToNative (Globe)', () => {
  it('maps baseMap to the native texture and carries cloud/specular fields', () => {
    const g = cosmographiaGeometryToNative({
      type: 'Globe',
      radii: [60268, 60268, 54364],
      baseMap: 'textures/saturn.jpg',
      cloudMap: 'textures/clouds.png',
      specularColor: '#202030',
      specularPower: 20,
      emissive: false,
    });
    expect(g).toEqual({
      type: 'Globe',
      radii: [60268, 60268, 54364],
      texture: 'textures/saturn.jpg',
      cloudMap: 'textures/clouds.png',
      specularColor: '#202030',
      specularPower: 20,
      emissive: false,
    });
  });

  it('keeps an explicit native texture when baseMap is absent', () => {
    const g = cosmographiaGeometryToNative({ type: 'Globe', texture: 'earth.jpg' });
    expect(g).toEqual({ type: 'Globe', texture: 'earth.jpg' });
  });
});

describe('cosmographiaGeometryToNative (RingSystem)', () => {
  it('maps innerRadius/outerRadius/texture into a native Rings geometry', () => {
    const g = cosmographiaGeometryToNative({
      type: 'RingSystem',
      innerRadius: 74500,
      outerRadius: 140220,
      texture: 'textures/saturn-rings.png',
    });
    expect(g).toEqual({
      type: 'Rings',
      innerRadius: 74500,
      outerRadius: 140220,
      texture: 'textures/saturn-rings.png',
    });
  });

  it('fails loudly when a ring system omits its radii', () => {
    expect(() => cosmographiaGeometryToNative({ type: 'RingSystem', texture: 'r.png' })).toThrow(
      CatalogError,
    );
  });
});

describe('cosmographiaGeometryToNative (unsupported)', () => {
  it('returns null for an unsupported geometry type', () => {
    expect(cosmographiaGeometryToNative({ type: 'ParticleSystem' })).toBeNull();
  });
});
