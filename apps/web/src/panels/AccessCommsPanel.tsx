// The Access & Comms domain tab (analysis-UX, design section 3, tab 3): the access tools (the
// composable constraint-stack access run, the selectable-pointing in-FOV observation windows)
// plus the comms link-budget worksheet, surfaced as collapsible TaskCards. Phase 1 upgrades the
// access card to assemble a constraint stack (line-of-sight, range, range-rate, sun keep-out) and
// the in-FOV card to a selectable boresight pointing mode showing FOV-only AND post-constraint
// surviving windows. The link card is unchanged (the link WORKSHEET is Phase 2). Presentational.

import { useState, type ReactNode } from 'react';
import { seriesToCsv, intervalsToCsv } from '@bessel/interop';
import type { BesselEngine } from '../engine/index.ts';
import {
  DEFAULT_ACCESS_CONSTRAINTS,
  type AccessConstraintSpec,
  type FovPointingMode,
} from '../engine/analysis-defaults.ts';
import { useStore, type AppStore } from '../store/index.ts';
import { IntervalResult, SeriesResult } from './analysis-result.tsx';
import { RunStatusNote } from './RunStatus.tsx';
import { TaskCardAccordion, type ExpandRequest, type TaskCardEntry } from './TaskCard.tsx';
import { LinkParamsForm, DEFAULT_LINK_PARAMS, type LinkParams } from './analysis-tool-forms.tsx';
import { AccessConstraintForm } from './AccessConstraintForm.tsx';
import {
  Action,
  EmptyNotice,
  FomNote,
  Keep,
  fmt,
  linkParamsPreamble,
  useAnalysisParams,
  useTrayFull,
} from './analysis-shared.tsx';

export interface AccessCommsPanelProps {
  readonly engine: BesselEngine | null;
  readonly store: AppStore;
  readonly hasSpacecraft: boolean;
  readonly expandRequest?: ExpandRequest;
}

const POINTING_OPTIONS: readonly { readonly value: FovPointingMode; readonly label: string }[] = [
  { value: 'nadir', label: 'Nadir' },
  { value: 'sun', label: 'Sun' },
];

export function AccessCommsPanel(props: AccessCommsPanelProps): JSX.Element {
  const { engine, store } = props;
  const params = useAnalysisParams(store, { withTarget: true, withSecondary: false });
  const { span, targetSpan, runMeta } = params;
  const trayFull = useTrayFull(store);

  const [link, setLink] = useState<LinkParams>(DEFAULT_LINK_PARAMS);
  const [constraints, setConstraints] = useState<AccessConstraintSpec>(DEFAULT_ACCESS_CONSTRAINTS);
  const [pointing, setPointing] = useState<FovPointingMode>('nadir');

  const runStatus = useStore(store, (s) => s.runStatus);
  const accessResult = useStore(store, (s) => s.accessResult);
  const accessBreakdown = useStore(store, (s) => s.accessBreakdown);
  const fovResult = useStore(store, (s) => s.fovResult);
  const fovSurviving = useStore(store, (s) => s.fovSurviving);
  const fovOk = useStore(store, (s) => s.fovOk);
  const linkSeries = useStore(store, (s) => s.linkSeries);
  const linkParams = useStore(store, (s) => s.linkParams);

  const accessCard = (): ReactNode => (
    <>
      <AccessConstraintForm value={constraints} onChange={setConstraints} />
      <Action
        variant="primary"
        status={runStatus['compute-access']}
        onClick={() => void engine?.computeAccessStack(constraints, targetSpan)}
        testId="compute-access"
      >
        Compute access
      </Action>
      <IntervalResult
        intervals={accessResult?.window ?? null}
        span={accessResult?.span ?? null}
        title={`${accessResult?.label ?? ''} access`}
        label={`${accessResult?.label ?? ''} access`}
        resultTestId="access-result"
        timelineTestId="access-timeline"
        hint="Assemble a constraint stack and find the surviving spacecraft-to-target access window."
        csv={{
          testId: 'access-csv',
          filename: 'access.csv',
          build: (i) => intervalsToCsv(i, { meta: runMeta }),
        }}
        extra={
          <>
            <FomNote fom={accessResult?.fom} verb="Coverage" noun="access" plural="es" testId="access-fom" />
            {accessBreakdown && accessBreakdown.length > 0 ? (
              <ul className="bessel-analysis-list" data-testid="access-breakdown">
                {accessBreakdown.map((b) => (
                  <li key={b.label} data-testid="access-breakdown-item">
                    {b.label}: alone admits {fmt(b.fom.percentCoverage * 100, 1)}% of the span.
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        }
      />
      <RunStatusNote status={runStatus['compute-access']} id="compute-access" />
      <Keep tool="access" disabled={!accessResult || trayFull} onKeep={() => engine?.keepSnapshot('access')} />
    </>
  );

  const fovCard = (): ReactNode => (
    <>
      <label className="bessel-constraint-band">
        Pointing mode
        <select
          value={pointing}
          data-testid="param-fov-pointing"
          onChange={(ev) => setPointing(ev.target.value as FovPointingMode)}
        >
          {POINTING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <p className="bessel-loader-hint" data-testid="fov-pointing-hint">
        Target-tracking pointing needs real attitude (CK) wiring, Phase 2.
      </p>
      <Action
        variant="primary"
        status={runStatus['compute-fov']}
        disabled={!fovOk}
        onClick={() => void engine?.computeFovWindows(pointing, constraints, targetSpan)}
        testId="compute-fov"
      >
        Compute in-FOV
      </Action>
      <IntervalResult
        intervals={fovResult?.window ?? null}
        span={fovResult?.span ?? null}
        title={`${fovResult?.label || 'Instrument'} in-FOV`}
        label={`${fovResult?.label || 'Instrument'} in-FOV`}
        resultTestId="fov-result"
        timelineTestId="fov-timeline"
        hint="Find when the target falls within the active sensor's FOV for the selected pointing mode."
        csv={{
          testId: 'fov-csv',
          filename: 'in-fov.csv',
          build: (i) => intervalsToCsv(i, { meta: runMeta }),
        }}
        extra={<FomNote fom={fovResult?.fom} verb="In view" noun="window" plural="s" testId="fov-fom" />}
      />
      <IntervalResult
        intervals={fovSurviving?.window ?? null}
        span={fovSurviving?.span ?? null}
        title={`${fovSurviving?.label || 'Instrument'} post-constraint`}
        label={`${fovSurviving?.label || 'Instrument'} post-constraint`}
        resultTestId="fov-surviving-result"
        timelineTestId="fov-surviving-timeline"
        hint="The in-FOV window after intersecting with the assembled access constraint stack."
        csv={{
          testId: 'fov-surviving-csv',
          filename: 'in-fov-surviving.csv',
          build: (i) => intervalsToCsv(i, { meta: runMeta }),
        }}
        extra={<FomNote fom={fovSurviving?.fom} verb="Surviving" noun="window" plural="s" testId="fov-surviving-fom" />}
      />
      <RunStatusNote status={runStatus['compute-fov']} id="compute-fov" />
    </>
  );

  const linkCard = (): ReactNode => (
    <>
      <LinkParamsForm value={link} onChange={setLink} />
      <Action
        variant="primary"
        status={runStatus['compute-link']}
        onClick={() =>
          void engine?.computeLinkBudget({
            ...span,
            eirpDbW: link.eirpDbW,
            freqHz: link.freqGHz * 1e9,
            gOverTDbK: link.gOverTDbK,
            dataRateBps: link.dataRateBps,
          })
        }
        testId="compute-link"
      >
        Compute downlink Eb/N0
      </Action>
      <SeriesResult
        series={linkSeries}
        resultTestId="link-result"
        chartTestId="link-chart"
        hint="Plot the downlink Eb/N0 to a ground station."
        csv={{
          testId: 'link-csv',
          filename: 'link-ebn0.csv',
          build: (s) =>
            linkParamsPreamble(linkParams) + seriesToCsv(s.et, [s.value], ['ebN0_dB'], { meta: runMeta }),
        }}
      />
      <RunStatusNote status={runStatus['compute-link']} id="compute-link" />
      <Keep tool="link" disabled={!linkSeries || trayFull} onKeep={() => engine?.keepSnapshot('link')} />
    </>
  );

  const cards: readonly TaskCardEntry[] = [
    {
      id: 'access',
      title: 'Constraint-stack access',
      purpose: 'Surviving visibility windows under a composable constraint stack.',
      status: runStatus['compute-access'],
      render: accessCard,
    },
    {
      id: 'in-fov',
      title: 'In-FOV observation windows',
      purpose: 'When a target falls within the active sensor FOV, by pointing mode.',
      status: runStatus['compute-fov'],
      render: fovCard,
    },
    {
      id: 'link',
      title: 'Downlink budget',
      purpose: 'Eb/N0 over the pass for a configured radio link.',
      status: runStatus['compute-link'],
      render: linkCard,
    },
  ];

  return (
    <div className="bessel-analysis" data-testid="access-comms-panel">
      <EmptyNotice hasSpacecraft={props.hasSpacecraft} />
      {params.paramsBar}
      <TaskCardAccordion
        cards={cards}
        defaultExpanded={['access', 'link']}
        {...(props.expandRequest ? { expandRequest: props.expandRequest } : {})}
      />
    </div>
  );
}
