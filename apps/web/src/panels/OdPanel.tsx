// The orbit-determination workbench surfaced in the viewer's "OD" menu. It drives the
// @bessel/od batch least-squares estimator on a small synthetic range / range-rate /
// angles measurement set (generated from a known truth orbit) and shows the recovered
// state, the post-fit residual RMS, and a 1-sigma covariance summary. Presentational:
// it reads the odResult slice and calls the engine. (Tapley-Schutz-Born §4.3.)

import { useState } from 'react';
import { Button, Tag } from '@bessel/selene-design';
import { type BesselEngine } from '../engine/index.ts';
import { useStore, type AppStore } from '../store/index.ts';
import { RunStatusNote, busyLabel } from './RunStatus.tsx';

export interface OdPanelProps {
  readonly engine: BesselEngine | null;
  readonly store: AppStore;
}

const fmt = (n: number, digits = 4): string =>
  Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : '-';

export function OdPanel(props: OdPanelProps): JSX.Element {
  const { engine, store } = props;
  const result = useStore(store, (s) => s.odResult);
  const objects = useStore(store, (s) => s.objects);
  const runStatus = useStore(store, (s) => s.runStatus);
  // [ux-p2-wave2b] The carrier targets one object of the SELECTED conjunction event; offer its
  // primary/secondary as the destination object id. The carrier needs an OD result, a selected
  // event, and an ingested catalog (the engine op fails loud when any is missing).
  const conjunctionEvent = useStore(store, (s) => s.conjunctionEvent);
  const carrierObjects = conjunctionEvent
    ? [conjunctionEvent.primaryId, conjunctionEvent.secondaryId]
    : [];
  const isSample = !objects.some((e) => e.kind === 'spacecraft');
  const run = busyLabel(runStatus['run-od'], 'Run batch least squares', 'Computing...');
  const [noise, setNoise] = useState(1);
  const [carrierObject, setCarrierObject] = useState('');
  const carrierTarget = carrierObject || carrierObjects[0] || '';

  return (
    <div className="bessel-analysis" data-testid="od-panel">
      <div className="bessel-analysis-params" data-testid="od-params">
        <label>
          Measurement noise scale
          <input
            type="number"
            min={0.01}
            step={0.5}
            value={noise}
            onChange={(ev) => setNoise(Math.max(0.01, Number(ev.target.value)))}
            data-testid="od-noise"
          />
        </label>
      </div>

      <Button
        variant="primary"
        full
        testId="run-od"
        disabled={run.disabled}
        onClick={() => void engine?.runOd(noise)}
      >
        {run.label}
      </Button>
      <RunStatusNote status={runStatus['run-od']} id="run-od" />

      {result ? (
        <div data-testid="od-result">
          {isSample ? (
            <span data-testid="sample-data-tag" style={{ display: 'inline-flex', marginBottom: 4 }}>
              <Tag tone="amber">Sample data</Tag>
            </span>
          ) : null}
          <p className="bessel-analysis-stat" data-testid="od-rms">
            {result.label}: residual RMS {fmt(result.residualRms, 3)} over {result.observationCount}{' '}
            observations, {result.iterations} iteration{result.iterations === 1 ? '' : 's'}
          </p>
          <p className="bessel-analysis-stat" data-testid="od-estimate">
            Estimated state (km, km/s): [{result.estimate.map((v) => fmt(v, 3)).join(', ')}]; position
            error {fmt(result.positionErrorKm * 1000, 1)} m, velocity error{' '}
            {fmt(result.velocityErrorKmS * 1e6, 1)} mm/s
          </p>
          <p className="bessel-analysis-stat" data-testid="od-covariance">
            Covariance (km): 1-sigma position x {fmt(result.sigmaPositionKm[0] * 1000, 1)} m, y{' '}
            {fmt(result.sigmaPositionKm[1] * 1000, 1)} m, z {fmt(result.sigmaPositionKm[2] * 1000, 1)} m
          </p>

          {/* [ux-p2-wave2b] Carrier: send this OD covariance into the Conjunction supplied-covariance
              store for the chosen object, then switch to the Conjunction tab. Needs a selected
              conjunction event (the destination object is its primary/secondary). */}
          <div className="bessel-analysis-params" data-testid="od-carrier">
            <label>
              Conjunction object
              <select
                value={carrierTarget}
                data-testid="od-carrier-object"
                onChange={(ev) => setCarrierObject(ev.target.value)}
              >
                {carrierObjects.length === 0 ? <option value="">(select an event first)</option> : null}
                {carrierObjects.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="secondary"
              testId="od-to-conjunction"
              disabled={!carrierTarget}
              onClick={() => void engine?.sendOdCovarianceToConjunction(carrierTarget)}
            >
              Use in Conjunction
            </Button>
          </div>
          <RunStatusNote status={runStatus['od-to-conjunction']} id="od-to-conjunction" />
        </div>
      ) : (
        <p className="bessel-loader-hint">
          Run a batch least-squares fit on a synthetic measurement set and recover the
          orbit state, residual RMS, and covariance.
        </p>
      )}
    </div>
  );
}
