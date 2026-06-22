// The configurable porkchop config form (analysis-UX Phase 2): departure and arrival bodies, a
// day-relative departure window range, and a time-of-flight day range. Presentational: it owns no
// state, rendering the supplied PorkchopFormState and reporting edits through onChange. Split out
// of LambertPorkchopCard to keep both under the component soft cap.

export interface PorkchopFormState {
  readonly departureBody: string;
  readonly arrivalBody: string;
  readonly centerBody: string;
  readonly departureDay0: number;
  readonly departureDay1: number;
  readonly tofDay0: number;
  readonly tofDay1: number;
}

// A heliocentric Earth -> Mars window is the canonical porkchop example; the bodies are editable
// against whatever the loaded ephemerides resolve.
export const DEFAULT_PORKCHOP_FORM: PorkchopFormState = {
  departureBody: 'EARTH',
  arrivalBody: 'MARS',
  centerBody: 'SUN',
  departureDay0: 0,
  departureDay1: 60,
  tofDay0: 120,
  tofDay1: 300,
};

export interface PorkchopFormProps {
  readonly value: PorkchopFormState;
  readonly bodyOptions: readonly string[];
  readonly onChange: (next: PorkchopFormState) => void;
}

export function PorkchopForm(props: PorkchopFormProps): JSX.Element {
  const { value, bodyOptions, onChange } = props;
  const set = <K extends keyof PorkchopFormState>(key: K, v: PorkchopFormState[K]): void =>
    onChange({ ...value, [key]: v });
  const num = (key: keyof PorkchopFormState, raw: string): void => set(key, Number(raw) as never);

  return (
    <div className="bessel-analysis-params" data-testid="porkchop-form">
      <label>
        Departure body
        <select
          data-testid="param-departure-body"
          value={value.departureBody}
          onChange={(ev) => set('departureBody', ev.target.value)}
        >
          {bodyOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        Arrival body
        <select
          data-testid="param-arrival-body"
          value={value.arrivalBody}
          onChange={(ev) => set('arrivalBody', ev.target.value)}
        >
          {bodyOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="bessel-range-group" data-testid="param-dep-range">
        <legend>Departure window (days from epoch)</legend>
        <label>
          from
          <input
            type="number"
            data-testid="param-dep-day0"
            value={value.departureDay0}
            onChange={(ev) => num('departureDay0', ev.target.value)}
          />
        </label>
        <label>
          to
          <input
            type="number"
            data-testid="param-dep-day1"
            value={value.departureDay1}
            onChange={(ev) => num('departureDay1', ev.target.value)}
          />
        </label>
      </fieldset>
      <fieldset className="bessel-range-group" data-testid="param-tof-range">
        <legend>Time of flight (days)</legend>
        <label>
          from
          <input
            type="number"
            data-testid="param-tof-day0"
            value={value.tofDay0}
            onChange={(ev) => num('tofDay0', ev.target.value)}
          />
        </label>
        <label>
          to
          <input
            type="number"
            data-testid="param-tof-day1"
            value={value.tofDay1}
            onChange={(ev) => num('tofDay1', ev.target.value)}
          />
        </label>
      </fieldset>
    </div>
  );
}
