// The Lighting & Geometry domain tab (analysis-UX re-slot, design section 3, tab 2):
// the geometry tools (spacecraft range, sub-point ground track) plus eclipse, surfaced as
// collapsible TaskCards. The tool JSX is moved verbatim from the former AnalysisPanel; no
// engine capability changes here. Presentational: it reads result slices and calls engine.

import { type ReactNode } from 'react';
import { GroundTrackMap } from '@bessel/ui';
import { seriesToCsv, intervalsToCsv } from '@bessel/interop';
import type { BesselEngine } from '../engine/index.ts';
import { useStore, type AppStore } from '../store/index.ts';
import { IntervalResult, ResultCsv, SeriesResult } from './analysis-result.tsx';
import { RunStatusNote } from './RunStatus.tsx';
import { TaskCardAccordion, type ExpandRequest, type TaskCardEntry } from './TaskCard.tsx';
import { Action, EmptyNotice, useAnalysisParams } from './analysis-shared.tsx';
import { RAD2DEG } from '../angles.ts';

export interface LightingGeometryPanelProps {
  readonly engine: BesselEngine | null;
  readonly store: AppStore;
  readonly hasSpacecraft: boolean;
  readonly expandRequest?: ExpandRequest;
}

export function LightingGeometryPanel(props: LightingGeometryPanelProps): JSX.Element {
  const { engine, store } = props;
  const params = useAnalysisParams(store, { withTarget: true, withSecondary: false });
  const { span, targetSpan, runMeta } = params;

  const runStatus = useStore(store, (s) => s.runStatus);
  const rangeSeries = useStore(store, (s) => s.rangeSeries);
  const groundTrack = useStore(store, (s) => s.groundTrack);
  const eclipseUmbra = useStore(store, (s) => s.eclipseUmbra);
  const eclipseSpan = useStore(store, (s) => s.eclipseSpan);

  const rangeCard = (): ReactNode => (
    <>
      <Action
        variant="primary"
        status={runStatus['compute-range']}
        onClick={() => void engine?.computeRange(targetSpan)}
        testId="compute-range"
      >
        Compute range
      </Action>
      <SeriesResult
        series={rangeSeries}
        resultTestId="range-result"
        chartTestId="range-chart"
        hint="Plot the spacecraft range over the next day."
        csv={{
          testId: 'range-csv',
          filename: 'range.csv',
          build: (s) => seriesToCsv(s.et, [s.value], ['range_km'], { meta: runMeta }),
        }}
      />
      <RunStatusNote status={runStatus['compute-range']} id="compute-range" />
    </>
  );

  const groundTrackCard = (): ReactNode => (
    <>
      <Action
        status={runStatus['compute-groundtrack']}
        onClick={() => void engine?.computeGroundTrack(span)}
        testId="compute-groundtrack"
      >
        Compute ground track
      </Action>
      {groundTrack ? (
        <div data-testid="groundtrack-result">
          <div className="bessel-panel-title">{groundTrack.label}</div>
          <GroundTrackMap
            lon={groundTrack.lon}
            lat={groundTrack.lat}
            label={groundTrack.label}
            testId="ground-track"
          />
          <ResultCsv
            testId="groundtrack-csv"
            filename="ground-track.csv"
            build={() =>
              seriesToCsv(
                groundTrack.et,
                [
                  Array.from(groundTrack.lon, (r) => r * RAD2DEG),
                  Array.from(groundTrack.lat, (r) => r * RAD2DEG),
                ],
                ['lon_deg', 'lat_deg'],
                { meta: runMeta },
              )
            }
          />
        </div>
      ) : (
        <p className="bessel-loader-hint">Project the sub-spacecraft point over the next day.</p>
      )}
      <RunStatusNote status={runStatus['compute-groundtrack']} id="compute-groundtrack" />
    </>
  );

  const eclipseCard = (): ReactNode => (
    <>
      <Action
        status={runStatus['compute-eclipse']}
        onClick={() => void engine?.computeEclipse(span)}
        testId="compute-eclipse"
      >
        Compute eclipse
      </Action>
      <IntervalResult
        intervals={eclipseUmbra}
        span={eclipseSpan}
        title="Umbra intervals"
        label="Eclipse umbra"
        resultTestId="eclipse-result"
        timelineTestId="eclipse-timeline"
        hint="Compute the spacecraft eclipse over the next day."
        csv={{
          testId: 'eclipse-csv',
          filename: 'eclipse-umbra.csv',
          build: (i) => intervalsToCsv(i, { meta: runMeta }),
        }}
      />
      <RunStatusNote status={runStatus['compute-eclipse']} id="compute-eclipse" />
    </>
  );

  const cards: readonly TaskCardEntry[] = [
    {
      id: 'range',
      title: 'Range to a target',
      purpose: 'Spacecraft-to-target distance over the span.',
      status: runStatus['compute-range'],
      render: rangeCard,
    },
    {
      id: 'ground-track',
      title: 'Ground track',
      purpose: 'Sub-spacecraft longitude/latitude over the span.',
      status: runStatus['compute-groundtrack'],
      render: groundTrackCard,
    },
    {
      id: 'eclipse',
      title: 'Eclipse intervals',
      purpose: 'Umbra entry/exit windows over the span.',
      status: runStatus['compute-eclipse'],
      render: eclipseCard,
    },
  ];

  return (
    <div className="bessel-analysis" data-testid="lighting-geometry-panel">
      <EmptyNotice hasSpacecraft={props.hasSpacecraft} />
      {params.paramsBar}
      <TaskCardAccordion
        cards={cards}
        defaultExpanded={['range', 'ground-track']}
        {...(props.expandRequest ? { expandRequest: props.expandRequest } : {})}
      />
    </div>
  );
}
