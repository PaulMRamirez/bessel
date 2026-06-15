import { describe, expect, it } from 'vitest';
import { parseAnyCatalog, formatLoadError } from './catalog-load.ts';

describe('parseAnyCatalog', () => {
  it('parses a native catalog and lists its bodies and spacecraft', () => {
    const text = JSON.stringify({
      version: '1.0',
      name: 'Test Mission',
      bodies: [{ id: 'saturn', name: 'Saturn' }, { id: 'titan' }],
    });
    const loaded = parseAnyCatalog('test.json', text);
    expect(loaded.kind).toBe('native');
    expect(loaded.name).toBe('Test Mission');
    // The entry id is the display name (so selection matches the scene body key);
    // a body without a name falls back to its id.
    expect(loaded.entries.map((e) => e.id)).toEqual(['Saturn', 'titan']);
    expect(loaded.entries.find((e) => e.id === 'titan')?.name).toBe('titan');
  });

  it('parses a Cosmographia catalog', () => {
    const text = JSON.stringify({
      name: 'Probe Mission',
      items: [
        {
          class: 'spacecraft',
          name: 'Probe',
          trajectory: { type: 'Spice', target: '-99', center: '6' },
        },
      ],
    });
    const loaded = parseAnyCatalog('probe.json', text);
    expect(loaded.kind).toBe('cosmographia');
    expect(loaded.entries[0]?.kind).toBe('spacecraft');
    expect(loaded.entries[0]?.name).toBe('Probe');
  });

  it('throws a located error for invalid JSON', () => {
    expect(() => parseAnyCatalog('x.json', '{ not json')).toThrow(/Not valid JSON/);
  });

  it('throws for an unrecognized format', () => {
    expect(() => parseAnyCatalog('x.json', JSON.stringify({ foo: 1 }))).toThrow(/Unrecognized/);
  });

  it('throws a located error for an invalid native catalog', () => {
    const text = JSON.stringify({ version: '1.0', bodies: [{ name: 'NoId' }] });
    let caught: unknown;
    try {
      parseAnyCatalog('x.json', text);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(formatLoadError(caught)).toMatch(/\$|id/);
  });
});
