import { describe, it, expect } from 'vitest';
import { toggleSelection, isSelected } from './selection.ts';

describe('multi-object selection', () => {
  it('adds and removes ids preserving order', () => {
    let sel: readonly string[] = [];
    sel = toggleSelection(sel, 'Saturn');
    sel = toggleSelection(sel, 'Cassini');
    expect(sel).toEqual(['Saturn', 'Cassini']);
    expect(isSelected(sel, 'Saturn')).toBe(true);
    sel = toggleSelection(sel, 'Saturn');
    expect(sel).toEqual(['Cassini']);
  });
});
