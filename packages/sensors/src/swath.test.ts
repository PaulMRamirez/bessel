// Time-evolving swath: a footprint ring per sample, and a coverage metric that grows
// as the sensor moves (a sweep covers more than a stare). (STK_PARITY_SPEC §4.7.)

import { describe, it, expect } from 'vitest';
import { accumulateSwath, swathCovers, swathCoverageFraction, type SensorSchema, type SwathSample } from './swath.ts';
import type { Vec3 } from './index.ts';

const schema: SensorSchema = { name: 'cam', kind: 'conic', halfAngleRad: 0.1 };
const center: Vec3 = { x: 0, y: 0, z: 0 };
const radius = 1;

// Nadir samples at altitude 1 (apex at radius+1 along +z, looking down -z), stepping
// the apex in x to sweep the sub-point across the sphere's north area.
function sampleAt(x: number): SwathSample {
  return { apex: { x, y: 0, z: 2 }, boresight: { x: 0, y: 0, z: -1 } };
}

describe('accumulateSwath', () => {
  it('produces one boundary ring per sample', () => {
    const swath = accumulateSwath([sampleAt(0), sampleAt(0.1)], schema, center, radius, 16);
    expect(swath.rings).toHaveLength(2);
    expect(swath.rings[0]!.length).toBeGreaterThan(0);
    expect(swath.points.length).toBe(swath.rings.flat().length);
  });
});

describe('swath coverage', () => {
  it('covers the sub-point under a nadir stare', () => {
    const samples = [sampleAt(0)];
    expect(swathCovers({ x: 0, y: 0, z: 1 }, samples, schema)).toBe(true); // north pole sub-point
    expect(swathCovers({ x: 1, y: 0, z: 0 }, samples, schema)).toBe(false); // equator, out of FOV
  });

  it('a moving sweep covers more test points than a single stare', () => {
    // Test points along a small arc near the north pole.
    const testPoints: Vec3[] = Array.from({ length: 40 }, (_, i) => {
      const a = (i / 40) * 0.3; // small polar angle
      return { x: Math.sin(a), y: 0, z: Math.cos(a) };
    });
    const stare = swathCoverageFraction(testPoints, [sampleAt(0)], schema);
    const sweep = swathCoverageFraction(
      testPoints,
      Array.from({ length: 10 }, (_, i) => sampleAt(i * 0.1)),
      schema,
    );
    expect(sweep).toBeGreaterThan(stare);
  });
});
