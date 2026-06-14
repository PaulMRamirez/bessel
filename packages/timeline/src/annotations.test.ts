import { describe, it, expect } from 'vitest';
import { sortByEt, markerFraction, type TimelineAnnotation } from './index.ts';

describe('@bessel/timeline annotations', () => {
  it('sorts by et without mutating the input', () => {
    const input: TimelineAnnotation[] = [
      { id: 'b', et: 20, label: 'b' },
      { id: 'a', et: 10, label: 'a' },
    ];
    const sorted = sortByEt(input);
    expect(sorted.map((a) => a.id)).toEqual(['a', 'b']);
    expect(input[0]!.id).toBe('b');
  });
  it('computes clamped marker fractions', () => {
    expect(markerFraction(0, 0, 100)).toBe(0);
    expect(markerFraction(50, 0, 100)).toBe(0.5);
    expect(markerFraction(100, 0, 100)).toBe(1);
    expect(markerFraction(-10, 0, 100)).toBe(0);
    expect(markerFraction(200, 0, 100)).toBe(1);
  });
});
