// Minimal timeline controls (Phase 0): play and pause, rate, epoch readout, and a
// scrub slider. Keyboard operable (native button and input semantics); the full
// Cosmographia shortcut set and accessibility pass arrive in later phases.

export interface TimelineControlsProps {
  readonly playing: boolean;
  readonly rate: number;
  readonly epochLabel: string;
  readonly min: number;
  readonly max: number;
  readonly value: number;
  readonly onPlayToggle: () => void;
  readonly onRateChange: (rate: number) => void;
  readonly onScrub: (et: number) => void;
}

const RATES = [1, 60, 3600, 86400, 604800];

export function TimelineControls(props: TimelineControlsProps): JSX.Element {
  return (
    <div className="bessel-timeline" role="group" aria-label="Timeline controls">
      <button type="button" onClick={props.onPlayToggle} aria-pressed={props.playing}>
        {props.playing ? 'Pause' : 'Play'}
      </button>
      <label>
        Rate
        <select
          value={props.rate}
          onChange={(e) => props.onRateChange(Number(e.target.value))}
          aria-label="Playback rate, seconds of mission time per second"
        >
          {RATES.map((r) => (
            <option key={r} value={r}>
              {r}x
            </option>
          ))}
        </select>
      </label>
      <input
        type="range"
        min={props.min}
        max={props.max}
        value={props.value}
        step={(props.max - props.min) / 1000 || 1}
        onChange={(e) => props.onScrub(Number(e.target.value))}
        aria-label="Scrub mission time"
        data-testid="scrub"
      />
      <span data-testid="epoch" className="bessel-epoch">
        {props.epochLabel}
      </span>
    </div>
  );
}
