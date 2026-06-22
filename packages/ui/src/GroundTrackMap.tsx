// A lightweight ground-track overlay: sub-spacecraft longitude/latitude samples (radians)
// projected by @bessel/map-projection and drawn as a polyline, with an optional set of
// ground-station markers draped in the same projection. No map tiles (general GIS is the MMGIS
// handoff); this is the orbital overlay. The engine supplies the lon/lat samples; the projection
// math is the shared core package (via ground-track-projection.ts) so the three selectable
// projections stay a single tested source of truth. Presentational: it takes the SELECTED
// projection + station markers as props (the projection <select> lives in the owning panel).
// (STK_PARITY_SPEC §4.12.)

import {
  projectToBox,
  placeStations,
  type GroundTrackProjection,
  type GroundTrackStation,
} from './ground-track-projection.ts';

export type { GroundTrackProjection, GroundTrackStation };

export interface GroundTrackMapProps {
  /** Sub-spacecraft longitude and latitude samples, radians. */
  readonly lon: Float64Array | readonly number[];
  readonly lat: Float64Array | readonly number[];
  readonly projection?: GroundTrackProjection;
  /** Optional ground stations to mark on the map (lon/lat radians). */
  readonly stations?: readonly GroundTrackStation[];
  readonly width?: number;
  readonly height?: number;
  readonly label?: string;
  readonly testId?: string;
}

export function GroundTrackMap(props: GroundTrackMapProps): JSX.Element {
  const w = props.width ?? 280;
  const h = props.height ?? 140;
  const kind = props.projection ?? 'equirectangular';
  const n = Math.min(props.lon.length, props.lat.length);

  // Project each sample to the SVG box (north up) and split the polyline where it jumps across
  // the box (an antimeridian wrap, or the polar disk's far side) so the track does not streak. A
  // segment with a single point (one sample trapped between two wraps) is kept and drawn as a dot
  // rather than silently dropped.
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  let prevX = NaN;
  for (let i = 0; i < n; i++) {
    const { x, y } = projectToBox(props.lon[i]!, props.lat[i]!, kind, w, h);
    if (!Number.isNaN(prevX) && Math.abs(x - prevX) > w / 2) {
      if (current.length >= 1) segments.push(current);
      current = [];
    }
    current.push({ x, y });
    prevX = x;
  }
  if (current.length >= 1) segments.push(current);

  const stations = placeStations(props.stations ?? [], kind, w, h);

  return (
    <svg
      className="bessel-groundtrack"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={props.label ?? 'Ground track'}
      data-testid={props.testId ?? 'ground-track'}
    >
      <rect className="bessel-groundtrack-bg" x={0} y={0} width={w} height={h} />
      {/* Equator and prime meridian for orientation. */}
      <line className="bessel-groundtrack-grid" x1={0} y1={h / 2} x2={w} y2={h / 2} />
      <line className="bessel-groundtrack-grid" x1={w / 2} y1={0} x2={w / 2} y2={h} />
      {segments.map((pts, i) =>
        pts.length >= 2 ? (
          <polyline
            key={i}
            className="bessel-groundtrack-line"
            fill="none"
            points={pts.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ')}
          />
        ) : (
          <circle
            key={i}
            className="bessel-groundtrack-point"
            cx={pts[0]!.x.toFixed(2)}
            cy={pts[0]!.y.toFixed(2)}
            r={1.5}
          />
        ),
      )}
      {stations.map((s) => (
        <g key={s.id} data-testid="groundtrack-station-overlay">
          <circle
            className="bessel-groundtrack-station"
            cx={s.x.toFixed(2)}
            cy={s.y.toFixed(2)}
            r={3}
          >
            <title>{s.name}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}
