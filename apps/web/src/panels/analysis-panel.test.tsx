import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { LightingGeometryPanel } from './LightingGeometryPanel.tsx';
import { AccessCommsPanel } from './AccessCommsPanel.tsx';
import { ConjunctionPanel } from './ConjunctionPanel.tsx';
import { CoveragePanel } from './CoveragePanel.tsx';
import { createAppStore, type AppStore } from '../store/index.ts';

// The former monolithic AnalysisPanel is re-slotted into intent-named domain panels, with
// each tool wrapped in a collapsible TaskCard (a collapsed card does not render its body).
// These tests assert the re-slot preserved every tool's reachability (its card toggle is
// present) and that an expanded card still renders the tool and its seeded result/testids.

const lighting = (store: AppStore, hasSpacecraft = false): string =>
  renderToStaticMarkup(createElement(LightingGeometryPanel, { engine: null, store, hasSpacecraft }));
const access = (store: AppStore, hasSpacecraft = false): string =>
  renderToStaticMarkup(createElement(AccessCommsPanel, { engine: null, store, hasSpacecraft }));
const conjunction = (store: AppStore, hasSpacecraft = false): string =>
  renderToStaticMarkup(createElement(ConjunctionPanel, { engine: null, store, hasSpacecraft }));
const coverage = (store: AppStore, hasSpacecraft = false): string =>
  renderToStaticMarkup(createElement(CoveragePanel, { engine: null, store, hasSpacecraft }));

describe('domain panels group the tools into TaskCards (B10 re-slot)', () => {
  it('renders an accordion with a card toggle for every re-slotted tool', () => {
    // Every tool is reachable via its TaskCard toggle, even when collapsed.
    const cardsByPanel: readonly [string, readonly string[]][] = [
      [lighting(createAppStore()), ['range', 'ground-track', 'eclipse']],
      [access(createAppStore()), ['access', 'in-fov', 'link']],
      [conjunction(createAppStore()), ['closest-approach', 'catalog-screen']],
      [coverage(createAppStore()), ['constellation', 'coverage-grid']],
    ];
    for (const [out, ids] of cardsByPanel) {
      expect(out).toContain('data-testid="taskcard-accordion"');
      for (const id of ids) {
        expect(out, `card ${id} toggle`).toContain(`data-testid="taskcard-${id}-toggle"`);
      }
    }
  });

  it('keeps each panel under the at-most-two-expanded cap on first render', () => {
    for (const out of [
      lighting(createAppStore()),
      access(createAppStore()),
      conjunction(createAppStore()),
      coverage(createAppStore()),
    ]) {
      const open = (out.match(/aria-expanded="true"/g) ?? []).length;
      expect(open).toBeLessThanOrEqual(2);
    }
  });
});

describe('domain panels surface the tools in their default-expanded cards', () => {
  it('renders the default-expanded tools (no tool dropped in the regroup)', () => {
    expect(lighting(createAppStore())).toContain('data-testid="compute-range"');
    expect(lighting(createAppStore())).toContain('data-testid="compute-groundtrack"');
    expect(access(createAppStore())).toContain('data-testid="compute-access"');
    expect(access(createAppStore())).toContain('data-testid="compute-link"');
    expect(conjunction(createAppStore())).toContain('data-testid="compute-conjunction"');
    expect(conjunction(createAppStore())).toContain('data-testid="screen-catalog"');
    expect(coverage(createAppStore())).toContain('data-testid="compute-constellation"');
    expect(coverage(createAppStore())).toContain('data-testid="compute-coverage-grid"');
    expect(coverage(createAppStore())).toContain('data-testid="clear-coverage-grid"');
  });

  it('promotes one amber primary action per expanded card, secondaries neutral', () => {
    const isPrimary = (out: string, testId: string): boolean => {
      const idx = out.indexOf(`data-testid="${testId}"`);
      if (idx < 0) return false;
      const after = out.slice(idx, idx + 600);
      const nextId = after.indexOf('data-testid=', 12);
      const tag = nextId > 0 ? after.slice(0, nextId) : after;
      return tag.includes('var(--amber)');
    };
    expect(isPrimary(lighting(createAppStore()), 'compute-range')).toBe(true);
    expect(isPrimary(lighting(createAppStore()), 'compute-groundtrack')).toBe(false);
    expect(isPrimary(access(createAppStore()), 'compute-access')).toBe(true);
    expect(isPrimary(access(createAppStore()), 'compute-link')).toBe(true);
    expect(isPrimary(conjunction(createAppStore()), 'compute-conjunction')).toBe(true);
    expect(isPrimary(coverage(createAppStore()), 'compute-constellation')).toBe(true);
  });
});

describe('Coverage panel coverage-grid overlay toggle', () => {
  it('renders the show + clear toggles in the coverage card', () => {
    const out = coverage(createAppStore());
    expect(out).toContain('data-testid="compute-coverage-grid"');
    expect(out).toContain('data-testid="clear-coverage-grid"');
  });

  it('shows the area-weighted summary once a coverage grid is seeded', () => {
    const store = createAppStore();
    store.setState({
      coverageGrid: { cellCount: 162, areaWeightedPercentCoverage: 0.42, label: 'Probe over EARTH' },
    });
    expect(coverage(store, true)).toContain('data-testid="coverage-grid-stat"');
  });
});

describe('domain panel tool parameter forms', () => {
  it('renders the link, conjunction, and constellation forms in their expanded cards', () => {
    for (const id of ['param-link-eirp', 'param-link-freq', 'param-link-gt', 'param-link-rate']) {
      expect(access(createAppStore())).toContain(`data-testid="${id}"`);
    }
    for (const id of ['param-conj-sigma', 'param-conj-radius']) {
      expect(conjunction(createAppStore())).toContain(`data-testid="${id}"`);
    }
    for (const id of [
      'param-const-total',
      'param-const-planes',
      'param-const-phasing',
      'param-const-inc',
      'param-const-alt',
      'param-const-pattern',
    ]) {
      expect(coverage(createAppStore())).toContain(`data-testid="${id}"`);
    }
  });
});

describe('domain panel CSV export', () => {
  it('offers a CSV export under each seeded result in an expanded card', () => {
    const series = { et: new Float64Array([0, 60]), value: new Float64Array([1, 2]), label: 's' };
    const lightStore = createAppStore();
    lightStore.setState({
      rangeSeries: series,
      groundTrack: {
        et: new Float64Array([0, 60]),
        lon: new Float64Array([0, 0.1]),
        lat: new Float64Array([0, 0.2]),
        label: 'gt',
      },
    });
    const lightOut = lighting(lightStore, true);
    expect(lightOut).toContain('data-testid="range-csv"');
    expect(lightOut).toContain('data-testid="groundtrack-csv"');

    const accessStore = createAppStore();
    accessStore.setState({ linkSeries: series });
    expect(access(accessStore, true)).toContain('data-testid="link-csv"');

    const conjStore = createAppStore();
    conjStore.setState({
      conjunction: { tcaSec: 10, missKm: 5, relSpeedKmS: 1, pc: 1e-4, sigmaKm: 1, radiusKm: 0.1, label: 'a vs b' },
    });
    expect(conjunction(conjStore, true)).toContain('data-testid="conjunction-csv"');

    const covStore = createAppStore();
    covStore.setState({
      constellation: {
        totalSats: 24,
        planes: 3,
        perPlane: 8,
        pattern: 'delta',
        phasing: 1,
        inclinationDeg: 53,
        altitudeKm: 700,
      },
    });
    expect(coverage(covStore, true)).toContain('data-testid="constellation-csv"');
  });
});

describe('Conjunction panel catalog screening (worker)', () => {
  it('renders the Screen catalog action inside its card', () => {
    const out = conjunction(createAppStore());
    expect(out).toContain('data-testid="catalog-screen"');
    expect(out).toContain('data-testid="screen-catalog"');
  });

  it('shows the progress readout and cancel button while a screen runs', () => {
    const store = createAppStore();
    store.setState({ screening: { status: 'running', done: 2, total: 4, epoch: 0, events: null } });
    const out = conjunction(store, true);
    expect(out).toContain('data-testid="screen-progress"');
    expect(out).toContain('data-testid="screen-cancel"');
    expect(out).toContain('Screening 2/4');
  });

  it('lists the flagged events once a screen completes, with TCA relative to the catalog epoch', () => {
    const store = createAppStore();
    store.setState({
      screening: {
        status: 'done',
        done: 4,
        total: 4,
        // The grid epoch is 120 s; the event's absolute TCA is 600 s, so the panel must show the
        // relative TCA (600 - 120) / 60 = 8 min, not the absolute 600 / 60 = 10 min.
        epoch: 120,
        events: [{ primaryId: 'CHASER', secondaryId: 'TARGET', tca: 600, missKm: 1.2, relSpeedKmS: 0.5, pc: null }],
      },
    });
    const out = conjunction(store, true);
    expect(out).toContain('data-testid="screen-events"');
    expect(out).toContain('data-testid="screen-event"');
    expect(out).toContain('CHASER vs TARGET');
    expect(out).toContain('8 min');
    expect(out).not.toContain('10 min');
  });
});

describe('domain panel result tables (B18)', () => {
  it('renders the chart/table toolbar and table over a seeded series and interval', () => {
    const store = createAppStore();
    store.setState({
      rangeSeries: {
        et: new Float64Array([0, 60]),
        value: new Float64Array([10, 20]),
        label: 'range (km)',
      },
    });
    const out = lighting(store, true);
    // Toolbar + table testids derive from the result testid.
    expect(out).toContain('data-testid="range-result-toolbar"');
    expect(out).toContain('data-testid="range-result-view-table"');
    expect(out).toContain('data-testid="range-result-copy"');
    expect(out).toContain('data-testid="range-result-precision"');
    expect(out).toContain('data-testid="range-result-view-chart"');

    const accessStore = createAppStore();
    accessStore.setState({
      accessResult: {
        window: [[0, 100]],
        span: [0, 200],
        label: 'Probe to SUN',
        fom: { percentCoverage: 0.5, accessCount: 1, maxGapSec: 100 },
      },
    });
    expect(access(accessStore, true)).toContain('data-testid="access-result-toolbar"');
  });
});

describe('the empty notice surfaces when no spacecraft is loaded', () => {
  it('shows the load-a-spacecraft notice on the domain panels', () => {
    expect(lighting(createAppStore(), false)).toContain('data-testid="analysis-empty-notice"');
    expect(access(createAppStore(), false)).toContain('data-testid="analysis-empty-notice"');
    expect(lighting(createAppStore(), true)).not.toContain('data-testid="analysis-empty-notice"');
  });
});
