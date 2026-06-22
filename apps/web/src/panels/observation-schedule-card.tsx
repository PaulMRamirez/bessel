// The multi-target observation schedule card (analysis-UX Phase 3, observation planner, pulled up
// from P3 per the critique). Takes a target LIST, the active instrument/FOV + the in-FOV pointing
// mode, and the access/keepout constraint stack, then runs the engine op to build a CONFLICT-FREE
// SCHEDULE: an ordered set of non-overlapping observation slots across targets where the attitude
// slew between consecutive targets fits the gap. Renders the ordered timeline + the per-slot table +
// any targets that could not be scheduled (conflicts). Reads the result through the store; the engine
// owns the geometry + the greedy scheduler. Presentational + the engine compute call.

import { createElement } from 'react';
import { IntervalTimeline } from '@bessel/ui';
import type { BesselEngine } from '../engine/index.ts';
import {
  useStore,
  type AppStore,
  type ObservationScheduleResult,
  type RunStatus,
} from '../store/index.ts';
import type { AccessConstraintSpec, ObservationScheduleSpec } from '../engine/analysis-defaults.ts';
import { parseTargetList } from '../engine/ops-access.ts';
import { Action, fmt } from './analysis-shared.tsx';
import { RunStatusNote } from './RunStatus.tsx';

interface ObservationScheduleCardProps {
  engine: BesselEngine | null;
  store: AppStore;
  runStatus: RunStatus | undefined;
  spec: ObservationScheduleSpec;
  setSpec: (v: ObservationScheduleSpec) => void;
  constraints: AccessConstraintSpec;
  /** The raw target-list text (so the comma/space input is preserved as typed). */
  targetText: string;
  setTargetText: (v: string) => void;
  span: { spanSec: number; stepSec: number };
}

/** Format an ET seconds value into a compact relative-minutes label for the schedule rows. */
const minsFrom = (et: number, t0: number): string => `${((et - t0) / 60).toFixed(1)} min`;

function ObservationScheduleBody(props: ObservationScheduleCardProps): JSX.Element {
  const { engine, store } = props;
  const schedule = useStore(store, (s) => s.observationSchedule);
  const targets = parseTargetList(props.targetText);

  const run = (): void => {
    void engine?.computeObservationSchedule(
      { ...props.spec, targets },
      props.constraints,
      props.span,
    );
  };

  return (
    <>
      <label className="bessel-constraint-band">
        Target list (comma or space separated)
        <input
          type="text"
          value={props.targetText}
          data-testid="param-target-list"
          placeholder="e.g. Titan, Sun"
          onChange={(ev) => props.setTargetText(ev.target.value)}
        />
      </label>
      <label className="bessel-constraint-band">
        Pointing mode
        <select
          value={props.spec.pointing}
          data-testid="param-schedule-pointing"
          onChange={(ev) =>
            props.setSpec({ ...props.spec, pointing: ev.target.value as ObservationScheduleSpec['pointing'] })
          }
        >
          <option value="nadir">Nadir</option>
          <option value="sun">Sun</option>
        </select>
      </label>
      <label className="bessel-constraint-band">
        Min dwell (s)
        <input
          type="number"
          step="any"
          min={0}
          value={props.spec.minDwellSec}
          data-testid="param-schedule-dwell"
          onChange={(ev) => {
            const n = Number(ev.target.value);
            if (Number.isFinite(n)) props.setSpec({ ...props.spec, minDwellSec: n });
          }}
        />
      </label>
      <p className="bessel-loader-hint">
        {targets.length === 0
          ? 'Add one or more observation targets to build a conflict-free schedule.'
          : `${targets.length} target${targets.length === 1 ? '' : 's'}: ${targets.join(', ')}.`}
      </p>
      <Action
        variant="primary"
        status={props.runStatus}
        disabled={targets.length === 0}
        onClick={run}
        testId="compute-observation-schedule"
      >
        Build schedule
      </Action>
      {schedule ? <ScheduleView schedule={schedule} /> : (
        <p className="bessel-loader-hint">
          An ordered, non-overlapping observation timeline across the targets, plus any conflicts.
        </p>
      )}
      <RunStatusNote status={props.runStatus} id="compute-observation-schedule" />
    </>
  );
}

function ScheduleView(props: { schedule: ObservationScheduleResult }): JSX.Element {
  const { schedule } = props;
  const t0 = schedule.span[0];
  const intervals = schedule.slots.map((s) => [s.start, s.stop] as [number, number]);
  return (
    <div data-testid="multi-target-schedule">
      <div className="bessel-panel-title">{schedule.label}</div>
      <p className="bessel-analysis-stat" data-testid="schedule-summary">
        {schedule.slots.length} scheduled, {schedule.unscheduled.length} unscheduled ({schedule.pointing}-pointed).
      </p>
      <IntervalTimeline
        intervals={intervals}
        span={schedule.span}
        label={`${schedule.slots.length} observation slots`}
        testId="schedule-timeline"
      />
      {schedule.slots.length > 0 ? (
        <ol className="bessel-analysis-list" data-testid="schedule-slots">
          {schedule.slots.map((s, i) => (
            <li key={`${s.targetName}-${i}`} data-testid={`schedule-slot-${i}`}>
              {s.targetName}: {minsFrom(s.start, t0)} to {minsFrom(s.stop, t0)}, slew{' '}
              {fmt(s.slewFromPrevDeg, 1)} deg in {fmt(s.slewFromPrevSec, 1)} s
            </li>
          ))}
        </ol>
      ) : null}
      <ul className="bessel-analysis-list" data-testid="schedule-unscheduled">
        {schedule.unscheduled.map((u) => (
          <li key={u.targetName} data-testid={`schedule-unscheduled-${u.targetName}`}>
            {u.targetName}: {u.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The accordion expects a node; returning a component ELEMENT gives the card its own hooks context. */
export function observationScheduleCard(props: ObservationScheduleCardProps): JSX.Element {
  return createElement(ObservationScheduleBody, props);
}
