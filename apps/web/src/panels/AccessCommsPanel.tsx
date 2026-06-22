// The Access & Comms domain tab (analysis-UX re-slot, design section 3, tab 3): the access
// tools (line-of-sight access, in-FOV observation windows) plus the comms link-budget
// worksheet, surfaced as collapsible TaskCards. The tool JSX is moved verbatim from the
// former AnalysisPanel; no engine capability changes here. Presentational.

import { useState, type ReactNode } from 'react';
import { seriesToCsv, intervalsToCsv } from '@bessel/interop';
import type { BesselEngine } from '../engine/index.ts';
import { useStore, type AppStore } from '../store/index.ts';
import { IntervalResult, SeriesResult } from './analysis-result.tsx';
import { RunStatusNote } from './RunStatus.tsx';
import { TaskCardAccordion, type ExpandRequest, type TaskCardEntry } from './TaskCard.tsx';
import { LinkParamsForm, DEFAULT_LINK_PARAMS, type LinkParams } from './analysis-tool-forms.tsx';
import {
  Action,
  EmptyNotice,
  FomNote,
  Keep,
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

export function AccessCommsPanel(props: AccessCommsPanelProps): JSX.Element {
  const { engine, store } = props;
  const params = useAnalysisParams(store, { withTarget: true, withSecondary: false });
  const { span, targetSpan, runMeta } = params;
  const trayFull = useTrayFull(store);

  const [link, setLink] = useState<LinkParams>(DEFAULT_LINK_PARAMS);

  const runStatus = useStore(store, (s) => s.runStatus);
  const accessResult = useStore(store, (s) => s.accessResult);
  const fovResult = useStore(store, (s) => s.fovResult);
  const fovOk = useStore(store, (s) => s.fovOk);
  const linkSeries = useStore(store, (s) => s.linkSeries);
  const linkParams = useStore(store, (s) => s.linkParams);

  const accessCard = (): ReactNode => (
    <>
      <Action
        variant="primary"
        status={runStatus['compute-access']}
        onClick={() => void engine?.computeAccess(targetSpan)}
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
        hint="Find the spacecraft line-of-sight access to the Sun."
        csv={{
          testId: 'access-csv',
          filename: 'access.csv',
          build: (i) => intervalsToCsv(i, { meta: runMeta }),
        }}
        extra={<FomNote fom={accessResult?.fom} verb="Coverage" noun="access" plural="es" testId="access-fom" />}
      />
      <RunStatusNote status={runStatus['compute-access']} id="compute-access" />
      <Keep tool="access" disabled={!accessResult || trayFull} onKeep={() => engine?.keepSnapshot('access')} />
    </>
  );

  const fovCard = (): ReactNode => (
    <>
      <Action
        status={runStatus['compute-fov']}
        disabled={!fovOk}
        onClick={() => void engine?.computeInstrumentFov(targetSpan)}
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
        hint="Find when the target falls within the active sensor's nadir-pointed FOV."
        csv={{
          testId: 'fov-csv',
          filename: 'in-fov.csv',
          build: (i) => intervalsToCsv(i, { meta: runMeta }),
        }}
        extra={<FomNote fom={fovResult?.fom} verb="In view" noun="window" plural="s" testId="fov-fom" />}
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
      title: 'Line-of-sight access',
      purpose: 'Visibility windows from the spacecraft to a target.',
      status: runStatus['compute-access'],
      render: accessCard,
    },
    {
      id: 'in-fov',
      title: 'In-FOV observation windows',
      purpose: 'When a target falls within the active sensor FOV.',
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
