// B20: the State panel's compute helper assembles a Cartesian state (spkezr) and
// osculating elements (oscelt) into a BodyState, solving Kepler's equation for the
// true anomaly. Deterministic mock SPICE; the element math is checked directly.

import { describe, it, expect } from 'vitest';
import type { SpiceEngine, OsculatingElements } from '@bessel/spice';
import { computeBodyState } from './body-state.ts';

// A mock SPICE returning a fixed state and caller-supplied osculating elements.
function mockSpice(opts: {
  readonly elts?: Partial<OsculatingElements>;
  readonly throwOn?: 'spkezr' | 'oscelt';
}): SpiceEngine {
  const engine = {
    spkezr: async () => {
      if (opts.throwOn === 'spkezr') throw new Error('no ephemeris');
      return { position: { x: 1000.5, y: -2000.25, z: 300 }, velocity: { x: 1.5, y: -2.25, z: 0.5 }, lightTime: 0 };
    },
    oscelt: async (): Promise<OsculatingElements> => {
      if (opts.throwOn === 'oscelt') throw new Error('bad mu');
      return {
        rp: 84000,
        ecc: 0.3,
        inc: Math.PI / 6,
        lnode: Math.PI / 3,
        argp: Math.PI / 4,
        m0: 0,
        t0: 0,
        mu: 3.79e7,
        ...opts.elts,
      };
    },
  };
  return engine as unknown as SpiceEngine;
}

describe('computeBodyState', () => {
  it('assembles r/v vectors and osculating elements with a derived semi-major axis', async () => {
    const s = await computeBodyState(mockSpice({}), 'Cassini', 'Saturn', 'J2000', 0, 3.79e7);
    expect(s).not.toBeNull();
    expect(s!.r).toEqual([1000.5, -2000.25, 300]);
    expect(s!.v).toEqual([1.5, -2.25, 0.5]);
    // a = rp / (1 - e) = 84000 / 0.7
    expect(s!.semiMajorKm).toBeCloseTo(120000, 3);
    expect(s!.incDeg).toBeCloseTo(30, 6);
    expect(s!.raanDeg).toBeCloseTo(60, 6);
    expect(s!.argpDeg).toBeCloseTo(45, 6);
    // m0 = 0 => true anomaly = 0 at periapsis.
    expect(s!.trueAnomalyDeg).toBeCloseTo(0, 6);
  });

  it('recovers true anomaly = mean anomaly for a circular orbit', async () => {
    const s = await computeBodyState(
      mockSpice({ elts: { ecc: 0, m0: Math.PI / 2 } }),
      'Probe',
      'Earth',
      'J2000',
      0,
      398600,
    );
    expect(s!.trueAnomalyDeg).toBeCloseTo(90, 6);
  });

  it('returns null when the body is its own center', async () => {
    expect(await computeBodyState(mockSpice({}), 'Saturn', 'Saturn', 'J2000', 0, 3.79e7)).toBeNull();
  });

  it('returns null (n/a) when spkezr or oscelt reject', async () => {
    expect(await computeBodyState(mockSpice({ throwOn: 'spkezr' }), 'A', 'B', 'J2000', 0, 1)).toBeNull();
    expect(await computeBodyState(mockSpice({ throwOn: 'oscelt' }), 'A', 'B', 'J2000', 0, 1)).toBeNull();
  });

  it('is finite and safe for a hyperbolic orbit (e > 1)', async () => {
    const s = await computeBodyState(
      mockSpice({ elts: { ecc: 1.4, m0: 0.5 } }),
      'Flyby',
      'Jupiter',
      'J2000',
      0,
      1.26e8,
    );
    expect(s).not.toBeNull();
    expect(Number.isFinite(s!.trueAnomalyDeg)).toBe(true);
    // a = rp / (1 - e) is negative for a hyperbola (conventional).
    expect(s!.semiMajorKm).toBeLessThan(0);
  });
});
