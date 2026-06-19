// The analysis workbench surfaced in the viewer's Analysis menu. Each tool runs one
// validated core engine (events, access/coverage, rf, conjunction, attitude, mission,
// map-projection, interop) on the loaded spacecraft mission and renders the result
// through the @bessel/ui charting primitives. Presentational: it reads analysis
// slices from the store and calls engine methods; all geometry lives in the engine.
// (STK_PARITY_SPEC F5 / §4.)

import type { ReactNode } from 'react';
import { GroundTrackMap, IntervalTimeline, TimeSeriesChart, downloadBlob } from '@bessel/ui';
import { seriesToCsv, intervalsToCsv } from '@bessel/interop';
import type { BesselEngine } from '../engine/index.ts';
import { useStore, type AppStore, type Series } from '../store/index.ts';

export interface AnalysisPanelProps {
  readonly engine: BesselEngine | null;
  readonly store: AppStore;
}

const fmt = (n: number, digits = 2): string =>
  Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : '-';

/** Download a CSV string as a file. */
function exportCsv(filename: string, csv: string): void {
  downloadBlob(new Blob([csv], { type: 'text/csv' }), filename);
}

/** A small "Export CSV" button used under each analysis result. */
function CsvButton(props: { onClick: () => void; testId: string }): JSX.Element {
  return (
    <button type="button" className="bessel-csv-button" onClick={props.onClick} data-testid={props.testId}>
      Export CSV
    </button>
  );
}

/** A time-series analysis result block: title + chart + optional CSV, or a hint. */
function SeriesResult(props: {
  series: Series | null;
  resultTestId: string;
  chartTestId: string;
  hint: string;
  csv?: { testId: string; filename: string; build: (s: Series) => string };
}): JSX.Element {
  const { series, csv } = props;
  if (!series) return <p className="bessel-loader-hint">{props.hint}</p>;
  return (
    <div data-testid={props.resultTestId}>
      <div className="bessel-panel-title">{series.label}</div>
      <TimeSeriesChart et={series.et} value={series.value} label={series.label} testId={props.chartTestId} />
      {csv ? <CsvButton testId={csv.testId} onClick={() => exportCsv(csv.filename, csv.build(series))} /> : null}
    </div>
  );
}

type Intervals = readonly (readonly [number, number])[];

/** An interval (Gantt) analysis result block: title + timeline + optional CSV/extra, or a hint. */
function IntervalResult(props: {
  intervals: Intervals | null;
  span: readonly [number, number] | null;
  title: string;
  label: string;
  resultTestId: string;
  timelineTestId: string;
  hint: string;
  csv?: { testId: string; filename: string; build: (i: Intervals) => string };
  extra?: ReactNode;
}): JSX.Element {
  const { intervals, span, csv } = props;
  if (!intervals || !span) return <p className="bessel-loader-hint">{props.hint}</p>;
  return (
    <div data-testid={props.resultTestId}>
      <div className="bessel-panel-title">{props.title}</div>
      <IntervalTimeline intervals={intervals} span={span} label={props.label} testId={props.timelineTestId} />
      {csv ? <CsvButton testId={csv.testId} onClick={() => exportCsv(csv.filename, csv.build(intervals))} /> : null}
      {props.extra}
    </div>
  );
}

/** A scalar-readout result: a stat paragraph when present, else a hint. */
function StatResult(props: { show: boolean; resultTestId: string; hint: string; children: ReactNode }): JSX.Element {
  return props.show ? (
    <p className="bessel-analysis-stat" data-testid={props.resultTestId}>
      {props.children}
    </p>
  ) : (
    <p className="bessel-loader-hint">{props.hint}</p>
  );
}

export function AnalysisPanel(props: AnalysisPanelProps): JSX.Element {
  const { engine, store } = props;
  const eclipseUmbra = useStore(store, (s) => s.eclipseUmbra);
  const eclipseSpan = useStore(store, (s) => s.eclipseSpan);
  const rangeSeries = useStore(store, (s) => s.rangeSeries);
  const accessWindow = useStore(store, (s) => s.accessWindow);
  const accessSpan = useStore(store, (s) => s.accessSpan);
  const accessLabel = useStore(store, (s) => s.accessLabel);
  const accessFom = useStore(store, (s) => s.accessFom);
  const linkSeries = useStore(store, (s) => s.linkSeries);
  const conjunction = useStore(store, (s) => s.conjunction);
  const constellation = useStore(store, (s) => s.constellation);
  const slewSeries = useStore(store, (s) => s.slewSeries);
  const transfer = useStore(store, (s) => s.transfer);
  const groundTrack = useStore(store, (s) => s.groundTrack);

  return (
    <div className="bessel-analysis" data-testid="analysis-panel">
      {/* Lighting (eclipse umbra) */}
      <button type="button" onClick={() => void engine?.computeEclipse()} data-testid="compute-eclipse">
        Compute eclipse (1 day)
      </button>
      <IntervalResult
        intervals={eclipseUmbra}
        span={eclipseSpan}
        title="Umbra intervals"
        label="Eclipse umbra"
        resultTestId="eclipse-result"
        timelineTestId="eclipse-timeline"
        hint="Compute the spacecraft eclipse over the next day."
        csv={{ testId: 'eclipse-csv', filename: 'eclipse-umbra.csv', build: (i) => intervalsToCsv(i) }}
      />

      {/* Range time series */}
      <button type="button" onClick={() => void engine?.computeRange()} data-testid="compute-range">
        Compute range (1 day)
      </button>
      <SeriesResult
        series={rangeSeries}
        resultTestId="range-result"
        chartTestId="range-chart"
        hint="Plot the spacecraft range over the next day."
        csv={{ testId: 'range-csv', filename: 'range.csv', build: (s) => seriesToCsv(s.et, [s.value], ['range_km']) }}
      />

      {/* Access windows + figure of merit */}
      <button type="button" onClick={() => void engine?.computeAccess()} data-testid="compute-access">
        Compute Sun access (1 day)
      </button>
      <IntervalResult
        intervals={accessWindow}
        span={accessSpan}
        title={`${accessLabel} access`}
        label={`${accessLabel} access`}
        resultTestId="access-result"
        timelineTestId="access-timeline"
        hint="Find the spacecraft line-of-sight access to the Sun."
        csv={{ testId: 'access-csv', filename: 'access.csv', build: (i) => intervalsToCsv(i) }}
        extra={
          accessFom ? (
            <p className="bessel-analysis-stat" data-testid="access-fom">
              Coverage {fmt(accessFom.percentCoverage * 100, 1)}%, {accessFom.accessCount} access
              {accessFom.accessCount === 1 ? '' : 'es'}, max gap {fmt(accessFom.maxGapSec / 60, 1)} min
            </p>
          ) : null
        }
      />

      {/* Communications link budget */}
      <button type="button" onClick={() => void engine?.computeLinkBudget()} data-testid="compute-link">
        Compute downlink Eb/N0 (1 day)
      </button>
      <SeriesResult
        series={linkSeries}
        resultTestId="link-result"
        chartTestId="link-chart"
        hint="Plot the downlink Eb/N0 to a DSN station."
      />

      {/* Conjunction (closest approach + Pc) */}
      <button type="button" onClick={() => void engine?.computeConjunction()} data-testid="compute-conjunction">
        Compute closest approach
      </button>
      <StatResult
        show={!!conjunction}
        resultTestId="conjunction-result"
        hint="Closest approach and collision probability for the loaded pair."
      >
        {conjunction && (
          <>
            {conjunction.label}: miss {fmt(conjunction.missKm)} km at TCA {fmt(conjunction.tcaSec / 60, 1)} min,
            rel speed {fmt(conjunction.relSpeedKmS, 3)} km/s, Pc {conjunction.pc.toExponential(2)}
          </>
        )}
      </StatResult>

      {/* Constellation design */}
      <button type="button" onClick={() => engine?.computeConstellation()} data-testid="compute-constellation">
        Design Walker constellation
      </button>
      <StatResult
        show={!!constellation}
        resultTestId="constellation-result"
        hint="Generate a Walker Delta constellation pattern."
      >
        {constellation && (
          <>
            Walker {constellation.pattern} {constellation.totalSats}/{constellation.planes}/1:
            {' '}{constellation.perPlane} sats x {constellation.planes} planes at {fmt(constellation.altitudeKm, 0)} km,
            {' '}{fmt(constellation.inclinationDeg, 0)} deg
          </>
        )}
      </StatResult>

      {/* Attitude slew profile */}
      <button type="button" onClick={() => void engine?.computeSlew()} data-testid="compute-slew">
        Compute attitude slew
      </button>
      <SeriesResult
        series={slewSeries}
        resultTestId="slew-result"
        chartTestId="slew-chart"
        hint="Eigen-axis slew from nadir to Sun pointing."
      />

      {/* Maneuver design (Lambert transfer) */}
      <button type="button" onClick={() => void engine?.computeTransfer()} data-testid="compute-transfer">
        Solve Lambert transfer
      </button>
      <StatResult
        show={!!transfer}
        resultTestId="transfer-result"
        hint="Lambert arc departure delta-v over a 2 h transfer."
      >
        {transfer && (
          <>
            {transfer.label}: delta-v {fmt(transfer.deltaVKmS, 4)} km/s over {fmt(transfer.tofHours, 1)} h
          </>
        )}
      </StatResult>

      {/* 2D ground track */}
      <button type="button" onClick={() => void engine?.computeGroundTrack()} data-testid="compute-groundtrack">
        Compute ground track (1 day)
      </button>
      {groundTrack ? (
        <div data-testid="groundtrack-result">
          <div className="bessel-panel-title">{groundTrack.label}</div>
          <GroundTrackMap lon={groundTrack.lon} lat={groundTrack.lat} label={groundTrack.label} testId="ground-track" />
        </div>
      ) : (
        <p className="bessel-loader-hint">Project the sub-spacecraft point over the next day.</p>
      )}

      {/* Interop: export CCSDS OEM */}
      <button type="button" onClick={() => void engine?.exportOem()} data-testid="export-oem">
        Export CCSDS OEM
      </button>
    </div>
  );
}
