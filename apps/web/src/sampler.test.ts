// Item 5 (relative speed): rangeRate is the line-of-sight component of relative
// velocity, negative when closing and positive when separating.

import { describe, it, expect } from 'vitest';
import { rangeRate } from './sampler.ts';

describe('rangeRate', () => {
  it('is negative when two bodies approach head-on', () => {
    // a at +x moving -x, b at origin stationary: closing at 2 km/s.
    expect(rangeRate([10, 0, 0], [0, 0, 0], [-2, 0, 0], [0, 0, 0])).toBeCloseTo(-2, 6);
  });

  it('is positive when two bodies separate', () => {
    expect(rangeRate([10, 0, 0], [0, 0, 0], [3, 0, 0], [0, 0, 0])).toBeCloseTo(3, 6);
  });

  it('ignores transverse motion (no range change)', () => {
    // a at +x moving +y: distance unchanged to first order.
    expect(rangeRate([10, 0, 0], [0, 0, 0], [0, 5, 0], [0, 0, 0])).toBeCloseTo(0, 6);
  });

  it('returns 0 for coincident points', () => {
    expect(rangeRate([0, 0, 0], [0, 0, 0], [1, 1, 1], [0, 0, 0])).toBe(0);
  });
});
