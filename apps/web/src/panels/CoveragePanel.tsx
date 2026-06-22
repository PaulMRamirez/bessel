// The Coverage & Constellation domain tab (analysis-UX re-slot, design section 3, tab 5):
// the Walker constellation designer and the area-weighted coverage-grid overlay, surfaced
// as collapsible TaskCards. The tool JSX is moved verbatim from the former AnalysisPanel;
// no engine capability changes here. Presentational.

import { useState, type ReactNode } from 'react';
import type { BesselEngine } from '../engine/index.ts';
import { useStore, type AppStore } from '../store/index.ts';
import { StatResult } from './analysis-result.tsx';
import { RunStatusNote } from './RunStatus.tsx';
import { TaskCardAccordion, type ExpandRequest, type TaskCardEntry } from './TaskCard.tsx';
import {
  ConstellationParamsForm,
  isValidWalker,
  DEFAULT_CONSTELLATION_PARAMS,
  type ConstellationFormParams,
} from './analysis-tool-forms.tsx';
import { Action, EmptyNotice, fmt, useAnalysisParams } from './analysis-shared.tsx';

export interface CoveragePanelProps {
  readonly engine: BesselEngine | null;
  readonly store: AppStore;
  readonly hasSpacecraft: boolean;
  readonly expandRequest?: ExpandRequest;
}

export function CoveragePanel(props: CoveragePanelProps): JSX.Element {
  const { engine, store } = props;
  const params = useAnalysisParams(store, { withTarget: false, withSecondary: false });
  const { span, scalarCsv } = params;

  const [constellationParams, setConstellationParams] =
    useState<ConstellationFormParams>(DEFAULT_CONSTELLATION_PARAMS);
  // Gate the constellation run on a buildable T/P so a valid-looking pair that does not
  // divide cannot fail silently inside walkerConstellation.
  const constellationValid = isValidWalker(constellationParams.totalSats, constellationParams.planes);

  const runStatus = useStore(store, (s) => s.runStatus);
  const constellation = useStore(store, (s) => s.constellation);
  const coverageGrid = useStore(store, (s) => s.coverageGrid);

  const constellationCard = (): ReactNode => (
    <>
      <ConstellationParamsForm value={constellationParams} onChange={setConstellationParams} />
      <Action
        variant="primary"
        status={runStatus['compute-constellation']}
        disabled={!constellationValid}
        onClick={() => engine?.computeConstellation(constellationParams)}
        testId="compute-constellation"
      >
        Design Walker constellation
      </Action>
      {!constellationValid ? (
        <p className="bessel-loader-hint" data-testid="constellation-invalid">
          Total sats (T) must be a positive multiple of the number of planes (P).
        </p>
      ) : null}
      <StatResult
        show={!!constellation}
        resultTestId="constellation-result"
        hint="Generate a Walker constellation pattern."
        csv={
          constellation
            ? {
                testId: 'constellation-csv',
                filename: 'constellation.csv',
                build: () =>
                  scalarCsv([
                    ['pattern', constellation.pattern],
                    ['total_sats', constellation.totalSats],
                    ['planes', constellation.planes],
                    ['phasing', constellation.phasing],
                    ['per_plane', constellation.perPlane],
                    ['inclination_deg', constellation.inclinationDeg],
                    ['altitude_km', constellation.altitudeKm],
                  ]),
              }
            : undefined
        }
      >
        {constellation && (
          <>
            Walker {constellation.pattern} {constellation.totalSats}/{constellation.planes}/{constellation.phasing}:
            {' '}{constellation.perPlane} sats x {constellation.planes} planes at {fmt(constellation.altitudeKm, 0)} km,
            {' '}{fmt(constellation.inclinationDeg, 0)} deg
          </>
        )}
      </StatResult>
      <RunStatusNote status={runStatus['compute-constellation']} id="compute-constellation" />
    </>
  );

  const gridCard = (): ReactNode => (
    <>
      <Action
        status={runStatus['compute-coverage-grid']}
        onClick={() => void engine?.computeCoverageGrid(span)}
        testId="compute-coverage-grid"
      >
        Show coverage grid
      </Action>
      {coverageGrid ? (
        <p className="bessel-analysis-stat" data-testid="coverage-grid-stat">
          {coverageGrid.label}: {fmt(coverageGrid.areaWeightedPercentCoverage * 100, 1)}% area-weighted coverage
          over {coverageGrid.cellCount} cells.
        </p>
      ) : (
        <p className="bessel-loader-hint">
          Drape a global coverage figure-of-merit grid on the globe, colored by coverage.
        </p>
      )}
      <Action
        status={runStatus['clear-coverage-grid']}
        disabled={!coverageGrid}
        onClick={() => void engine?.clearCoverageGrid()}
        testId="clear-coverage-grid"
      >
        Clear coverage grid
      </Action>
      <RunStatusNote status={runStatus['compute-coverage-grid']} id="compute-coverage-grid" />
    </>
  );

  const cards: readonly TaskCardEntry[] = [
    {
      id: 'constellation',
      title: 'Walker constellation',
      purpose: 'Design a Walker T/P/F constellation pattern.',
      status: runStatus['compute-constellation'],
      render: constellationCard,
    },
    {
      id: 'coverage-grid',
      title: 'Coverage grid',
      purpose: 'Area-weighted coverage FOM draped on the globe.',
      status: runStatus['compute-coverage-grid'],
      render: gridCard,
    },
  ];

  return (
    <div className="bessel-analysis" data-testid="coverage-panel">
      <EmptyNotice hasSpacecraft={props.hasSpacecraft} />
      {params.paramsBar}
      <TaskCardAccordion
        cards={cards}
        defaultExpanded={['constellation', 'coverage-grid']}
        {...(props.expandRequest ? { expandRequest: props.expandRequest } : {})}
      />
    </div>
  );
}
