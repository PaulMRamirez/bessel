// Measurement panel: shows the straight-line distance between the first two
// selected objects. Presentational; the engine computes the distance from
// ephemerides and the viewer passes it through.

const AU_KM = 1.495978707e8;

export interface MeasurePanelProps {
  readonly from: string | null;
  readonly to: string | null;
  readonly distanceKm: number | null;
  /** Range rate, km/s: negative closing, positive separating, or null. */
  readonly relativeSpeedKmS?: number | null;
  /** Angular separation seen from the spacecraft, degrees, or null. */
  readonly angleDeg?: number | null;
  /** The observer the angle is measured from (the mission spacecraft). */
  readonly observer?: string | null;
}

function formatDistance(km: number): string {
  const base = `${Math.round(km).toLocaleString('en-US')} km`;
  if (km >= 1e7) return `${base} (${(km / AU_KM).toFixed(3)} AU)`;
  return base;
}

function formatSpeed(kmS: number): string {
  const trend = kmS < 0 ? 'closing' : 'separating';
  return `${Math.abs(kmS).toFixed(3)} km/s ${trend}`;
}

export function MeasurePanel(props: MeasurePanelProps): JSX.Element {
  if (props.from === null || props.to === null || props.distanceKm === null) {
    return (
      <div className="bessel-measure" data-testid="measure-panel">
        <p className="bessel-measure-empty">Select two objects to measure</p>
      </div>
    );
  }
  return (
    <div className="bessel-measure" data-testid="measure-panel">
      <div className="bessel-measure-pair">
        {props.from} to {props.to}
      </div>
      <div className="bessel-measure-value" data-testid="measure-distance">
        {formatDistance(props.distanceKm)}
      </div>
      {props.relativeSpeedKmS !== null && props.relativeSpeedKmS !== undefined ? (
        <div className="bessel-measure-speed" data-testid="measure-speed">
          {formatSpeed(props.relativeSpeedKmS)}
        </div>
      ) : null}
      {props.angleDeg !== null && props.angleDeg !== undefined ? (
        <div className="bessel-measure-angle" data-testid="measure-angle">
          {props.angleDeg.toFixed(2)} deg apart from {props.observer ?? 'the spacecraft'}
        </div>
      ) : null}
    </div>
  );
}
