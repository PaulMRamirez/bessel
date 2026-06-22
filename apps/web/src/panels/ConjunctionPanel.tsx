// The Conjunction domain tab (analysis-UX re-slot, design section 3, tab 4): the per-pair
// closest-approach + collision-probability tool and the off-main-thread all-vs-all catalog
// screening, surfaced as collapsible TaskCards. The tool JSX is moved verbatim from the
// former AnalysisPanel; no engine capability changes here. Presentational.

import { useState, type ReactNode } from 'react';
import type { BesselEngine } from '../engine/index.ts';
import { useStore, type AppStore } from '../store/index.ts';
import { StatResult } from './analysis-result.tsx';
import { RunStatusNote } from './RunStatus.tsx';
import { TaskCardAccordion, type ExpandRequest, type TaskCardEntry } from './TaskCard.tsx';
import {
  ConjunctionParamsForm,
  DEFAULT_CONJUNCTION_PARAMS,
  type ConjunctionParams,
} from './analysis-tool-forms.tsx';
import {
  Action,
  CatalogScreen,
  EmptyNotice,
  Keep,
  fmt,
  useAnalysisParams,
  useTrayFull,
} from './analysis-shared.tsx';

export interface ConjunctionPanelProps {
  readonly engine: BesselEngine | null;
  readonly store: AppStore;
  readonly hasSpacecraft: boolean;
  readonly expandRequest?: ExpandRequest;
}

export function ConjunctionPanel(props: ConjunctionPanelProps): JSX.Element {
  const { engine, store } = props;
  const params = useAnalysisParams(store, { withTarget: false, withSecondary: true });
  const { secondary, scalarCsv } = params;
  const trayFull = useTrayFull(store);

  const [conj, setConj] = useState<ConjunctionParams>(DEFAULT_CONJUNCTION_PARAMS);

  const runStatus = useStore(store, (s) => s.runStatus);
  const conjunction = useStore(store, (s) => s.conjunction);
  const screening = useStore(store, (s) => s.screening);

  const conjunctionCard = (): ReactNode => (
    <>
      <ConjunctionParamsForm value={conj} onChange={setConj} />
      <Action
        variant="primary"
        status={runStatus['compute-conjunction']}
        onClick={() =>
          void engine?.computeConjunction({
            ...(secondary ? { secondary } : {}),
            sigmaKm: conj.sigmaKm,
            radiusKm: conj.radiusKm,
          })
        }
        testId="compute-conjunction"
      >
        Compute closest approach
      </Action>
      <StatResult
        show={!!conjunction}
        resultTestId="conjunction-result"
        hint="Closest approach and collision probability for the loaded pair."
        csv={
          conjunction
            ? {
                testId: 'conjunction-csv',
                filename: 'conjunction.csv',
                build: () =>
                  scalarCsv([
                    ['pair', conjunction.label],
                    ['miss_km', conjunction.missKm],
                    ['tca_s', conjunction.tcaSec],
                    ['rel_speed_km_s', conjunction.relSpeedKmS],
                    ['pc', conjunction.pc],
                    ['sigma_km', conjunction.sigmaKm],
                    ['hard_body_radius_km', conjunction.radiusKm],
                  ]),
              }
            : undefined
        }
      >
        {conjunction && (
          <>
            {conjunction.label}: miss {fmt(conjunction.missKm)} km at TCA {fmt(conjunction.tcaSec / 60, 1)} min,
            rel speed {fmt(conjunction.relSpeedKmS, 3)} km/s, Pc {conjunction.pc.toExponential(2)}
          </>
        )}
      </StatResult>
      <RunStatusNote status={runStatus['compute-conjunction']} id="compute-conjunction" />
      <Keep tool="conjunction" disabled={!conjunction || trayFull} onKeep={() => engine?.keepSnapshot('conjunction')} />
    </>
  );

  const screenCard = (): ReactNode => (
    <>
      <CatalogScreen engine={engine} screening={screening} runStatus={runStatus['screen-catalog']} />
      <RunStatusNote status={runStatus['screen-catalog']} id="screen-catalog" />
    </>
  );

  const cards: readonly TaskCardEntry[] = [
    {
      id: 'closest-approach',
      title: 'Closest approach (pair)',
      purpose: 'Miss distance, TCA, and collision probability for a pair.',
      status: runStatus['compute-conjunction'],
      render: conjunctionCard,
    },
    {
      id: 'catalog-screen',
      title: 'Catalog screening',
      purpose: 'All-vs-all worker screen over a synthetic catalog.',
      status: runStatus['screen-catalog'],
      render: screenCard,
    },
  ];

  return (
    <div className="bessel-analysis" data-testid="conjunction-panel">
      <EmptyNotice hasSpacecraft={props.hasSpacecraft} />
      {params.paramsBar}
      <TaskCardAccordion
        cards={cards}
        defaultExpanded={['closest-approach', 'catalog-screen']}
        {...(props.expandRequest ? { expandRequest: props.expandRequest } : {})}
      />
    </div>
  );
}
