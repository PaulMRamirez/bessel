// Telemetry adapter (item 6, Phase 4 real-time): a transport-neutral adapter
// that ingests live state vectors from a WebSocket-like source (Yamcs, OpenMCT)
// and pairs each actual sample with a predicted position to drive a
// predicted-versus-actual overlay. Pure over a SocketLike and a predictor, so it
// is unit-testable with a mock socket and carries no SPICE or Three.js.

export type Vec3 = readonly [number, number, number];

export interface TelemetrySample {
  /** Ephemeris time (TDB seconds) of the measurement. */
  readonly et: number;
  /** Measured position, km, in the working frame. */
  readonly position: Vec3;
}

export interface PredictedVsActual {
  readonly et: number;
  readonly predicted: Vec3;
  readonly actual: Vec3;
  /** Distance between predicted and actual, km. */
  readonly residualKm: number;
}

/** Minimal WebSocket surface the adapter needs (browser WebSocket satisfies it). */
export interface SocketLike {
  addEventListener(type: 'message', listener: (ev: { data: string }) => void): void;
  addEventListener(type: 'close', listener: () => void): void;
  close(): void;
}

/** Euclidean distance (km) between two positions. */
export function residualKm(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Parse one telemetry frame: {"et": number, "position": [x,y,z]}. Throws loudly. */
export function parseTelemetryMessage(raw: string): TelemetrySample {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new TelemetryError(`Telemetry frame is not JSON: ${String(err)}`);
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new TelemetryError('Telemetry frame must be an object');
  }
  const record = parsed as Record<string, unknown>;
  const et = record['et'];
  const position = record['position'];
  if (typeof et !== 'number' || !Number.isFinite(et)) {
    throw new TelemetryError('Telemetry frame is missing a numeric "et"');
  }
  if (
    !Array.isArray(position) ||
    position.length !== 3 ||
    !position.every((n) => typeof n === 'number' && Number.isFinite(n))
  ) {
    throw new TelemetryError('Telemetry frame "position" must be three finite numbers');
  }
  return { et, position: [position[0], position[1], position[2]] as Vec3 };
}

export class TelemetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TelemetryError';
  }
}

export class TelemetryAdapter {
  private readonly samples: TelemetrySample[] = [];
  private lastError: string | null = null;

  /**
   * @param socket  the live telemetry source.
   * @param predict the predicted position at an epoch (typically a SPICE sample).
   */
  constructor(
    private readonly socket: SocketLike,
    private readonly predict: (et: number) => Vec3,
  ) {
    socket.addEventListener('message', (ev) => this.ingest(ev.data));
  }

  private ingest(raw: string): void {
    try {
      this.samples.push(parseTelemetryMessage(raw));
      this.lastError = null;
    } catch (err) {
      // Keep the stream alive but record the fault loudly for the UI to surface.
      this.lastError = err instanceof Error ? err.message : String(err);
    }
  }

  /** The full predicted-versus-actual series in arrival order. */
  overlay(): PredictedVsActual[] {
    return this.samples.map((s) => {
      const predicted = this.predict(s.et);
      return { et: s.et, predicted, actual: s.position, residualKm: residualKm(predicted, s.position) };
    });
  }

  /** The most recent comparison, or null before any sample arrives. */
  latest(): PredictedVsActual | null {
    const last = this.samples[this.samples.length - 1];
    if (!last) return null;
    const predicted = this.predict(last.et);
    return {
      et: last.et,
      predicted,
      actual: last.position,
      residualKm: residualKm(predicted, last.position),
    };
  }

  sampleCount(): number {
    return this.samples.length;
  }

  error(): string | null {
    return this.lastError;
  }

  dispose(): void {
    this.socket.close();
  }
}
