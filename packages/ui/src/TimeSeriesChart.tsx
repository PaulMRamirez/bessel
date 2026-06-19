// A lightweight SVG time-series chart for analysis quantities (range, elevation,
// link margin, solar intensity, ...). No charting library: a single scaled polyline.
// (STK_PARITY_SPEC F5 / §4.10.)

export interface TimeSeriesChartProps {
  readonly et: Float64Array | readonly number[];
  readonly value: Float64Array | readonly number[];
  readonly width?: number;
  readonly height?: number;
  readonly label?: string;
  readonly testId?: string;
}

export function TimeSeriesChart(props: TimeSeriesChartProps): JSX.Element {
  const w = props.width ?? 280;
  const h = props.height ?? 80;
  const n = Math.min(props.et.length, props.value.length);
  const pad = 2;

  let points = '';
  if (n >= 2) {
    let t0 = Infinity;
    let t1 = -Infinity;
    let vMin = Infinity;
    let vMax = -Infinity;
    for (let i = 0; i < n; i++) {
      const t = props.et[i]!;
      const v = props.value[i]!;
      if (t < t0) t0 = t;
      if (t > t1) t1 = t;
      if (v < vMin) vMin = v;
      if (v > vMax) vMax = v;
    }
    const dt = t1 - t0 || 1;
    const dv = vMax - vMin || 1;
    const coords: string[] = [];
    for (let i = 0; i < n; i++) {
      const x = pad + ((props.et[i]! - t0) / dt) * (w - 2 * pad);
      // SVG y grows downward; invert so larger values are higher.
      const y = pad + (1 - (props.value[i]! - vMin) / dv) * (h - 2 * pad);
      coords.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    points = coords.join(' ');
  }

  return (
    <svg
      className="bessel-chart"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={props.label ?? 'Time series'}
      data-testid={props.testId ?? 'time-series-chart'}
    >
      {points ? <polyline className="bessel-chart-line" fill="none" points={points} /> : null}
    </svg>
  );
}
