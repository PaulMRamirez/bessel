// The Orbit & Maneuver Phase-1 panels surface the editable spacecraft source -> propagation
// and the editable MCS builder. These tests assert the new controls and testids render, that
// the propagate card shows a no-source hint (no hardcoded sample fallback) and gates SGP4 on a
// TLE source, and that a seeded MCS result surfaces the residual trace + solved delta-v.
// (analysis-UX Phase 1.)

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { PropagatePanel } from './PropagatePanel.tsx';
import { MissionPanel } from './MissionPanel.tsx';
import { createAppStore, type AppStore } from '../store/index.ts';

const propagate = (store: AppStore): string =>
  renderToStaticMarkup(createElement(PropagatePanel, { engine: null, store }));
const mission = (store: AppStore): string =>
  renderToStaticMarkup(createElement(MissionPanel, { engine: null, store }));

describe('PropagatePanel editable spacecraft source', () => {
  it('renders the source control with the TLE/object toggle and the source input', () => {
    const out = propagate(createAppStore());
    for (const id of ['sc-source-control', 'sc-source-tle', 'sc-source-object', 'param-sc-source']) {
      expect(out, id).toContain(`data-testid="${id}"`);
    }
  });

  it('shows a no-source hint and disables SGP4 until a source is set (no sample fallback)', () => {
    const out = propagate(createAppStore());
    expect(out).toContain('data-testid="propagate-no-source"');
    expect(out).toContain('data-testid="sc-source-hint"');
    // The SGP4 button renders disabled with no TLE source.
    const idx = out.indexOf('data-testid="propagate-tle"');
    expect(out.slice(idx - 200, idx + 50)).toContain('disabled');
  });

  it('enables SGP4 and shows the active source once a TLE source is set', () => {
    const store = createAppStore();
    store.setState((s) => ({
      scenario: {
        ...s.scenario,
        spacecraftSource: { kind: 'tle', name: 'TLE 5', line1: 'L1', line2: 'L2' },
        primarySpacecraft: 'TLE 5',
      },
    }));
    const out = propagate(store);
    expect(out).toContain('data-testid="sc-source-active"');
    expect(out).not.toContain('data-testid="propagate-no-source"');
  });

  it('keeps an object source from enabling SGP4 (object propagates via HPOP only)', () => {
    const store = createAppStore();
    store.setState((s) => ({
      scenario: { ...s.scenario, spacecraftSource: { kind: 'object', name: 'Cassini' }, primarySpacecraft: 'Cassini' },
    }));
    const out = propagate(store);
    const idx = out.indexOf('data-testid="propagate-tle"');
    expect(out.slice(idx - 200, idx + 50)).toContain('disabled');
    // HPOP is enabled for an object source.
    const hpop = out.indexOf('data-testid="propagate-hpop"');
    expect(out.slice(hpop - 200, hpop + 50)).not.toMatch(/disabled=""/);
  });
});

describe('MissionPanel editable MCS builder', () => {
  it('renders the segment editor with the add-segment menu and a row per default segment', () => {
    const out = mission(createAppStore());
    expect(out).toContain('data-testid="mcs-segment-editor"');
    expect(out).toContain('data-testid="mcs-add-segment"');
    // The default editable design has four segments (InitialState, Propagate, Maneuver, Target).
    for (const i of [0, 1, 2, 3]) {
      expect(out, `segment ${i}`).toContain(`data-testid="mcs-segment-${i}"`);
    }
    expect(out).toContain('data-testid="run-mcs"');
  });

  it('surfaces the residual trace and solved delta-v once an MCS result is seeded', () => {
    const store = createAppStore();
    store.setState({
      mcsResult: {
        finalRadiusKm: 7200,
        finalSpeedKmS: 7.4,
        finalEpoch: 0,
        altitude: { et: new Float64Array([0, 60]), value: new Float64Array([800, 820]), label: 'MCS altitude (km)' },
        converged: true,
        iterations: 3,
        goals: [{ type: 'Radius', achieved: 7200, desired: 7200, residual: 0.2, satisfied: true }],
        residualHistory: [
          { iter: 0, normF: 50 },
          { iter: 1, normF: 5 },
          { iter: 2, normF: 0.1 },
        ],
        solvedDvKmS: 0.123,
        label: 'Editable MCS',
      },
    });
    const out = mission(store);
    expect(out).toContain('data-testid="mcs-residuals"');
    expect(out).toContain('data-testid="mcs-solved-dv"');
    expect(out).toContain('data-testid="mcs-dc-report"');
    expect(out).toContain('converged');
  });
});
