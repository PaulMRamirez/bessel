// Item 6 (telemetry adapter): a mock WebSocket drives the predicted-versus-actual
// overlay; malformed frames fail loudly without killing the stream.

import { describe, it, expect } from 'vitest';
import {
  TelemetryAdapter,
  parseTelemetryMessage,
  residualKm,
  type SocketLike,
  type Vec3,
} from './telemetry.ts';

// A mock socket that lets the test push frames and observe close().
class MockSocket implements SocketLike {
  private messageCb: ((ev: { data: string }) => void) | null = null;
  closed = false;
  addEventListener(type: 'message' | 'close', listener: never): void {
    if (type === 'message') this.messageCb = listener as (ev: { data: string }) => void;
  }
  emit(data: string): void {
    this.messageCb?.({ data });
  }
  close(): void {
    this.closed = true;
  }
}

describe('parseTelemetryMessage', () => {
  it('parses a well-formed frame', () => {
    expect(parseTelemetryMessage('{"et":100,"position":[1,2,3]}')).toEqual({
      et: 100,
      position: [1, 2, 3],
    });
  });

  it('rejects non-JSON, missing et, and bad position', () => {
    expect(() => parseTelemetryMessage('not json')).toThrow(/not JSON/);
    expect(() => parseTelemetryMessage('{"position":[1,2,3]}')).toThrow(/numeric "et"/);
    expect(() => parseTelemetryMessage('{"et":1,"position":[1,2]}')).toThrow(/three finite/);
  });
});

describe('residualKm', () => {
  it('is the Euclidean distance between predicted and actual', () => {
    expect(residualKm([0, 0, 0], [3, 4, 0])).toBeCloseTo(5, 6);
  });
});

describe('TelemetryAdapter', () => {
  const predict = (et: number): Vec3 => [et, 0, 0];

  it('pairs each actual sample with the prediction and computes residuals', () => {
    const socket = new MockSocket();
    const adapter = new TelemetryAdapter(socket, predict);
    expect(adapter.latest()).toBeNull();

    socket.emit('{"et":10,"position":[10,0,0]}'); // matches prediction exactly
    socket.emit('{"et":20,"position":[20,3,4]}'); // 5 km off

    const overlay = adapter.overlay();
    expect(overlay).toHaveLength(2);
    expect(overlay[0]!.residualKm).toBeCloseTo(0, 6);
    expect(overlay[1]!.residualKm).toBeCloseTo(5, 6);
    expect(adapter.latest()?.et).toBe(20);
    expect(adapter.sampleCount()).toBe(2);
  });

  it('records a loud error for a malformed frame but keeps the stream alive', () => {
    const socket = new MockSocket();
    const adapter = new TelemetryAdapter(socket, predict);
    socket.emit('garbage');
    expect(adapter.error()).toMatch(/not JSON/);
    socket.emit('{"et":5,"position":[5,0,0]}');
    expect(adapter.error()).toBeNull();
    expect(adapter.sampleCount()).toBe(1);
  });

  it('closes the socket on dispose', () => {
    const socket = new MockSocket();
    new TelemetryAdapter(socket, predict).dispose();
    expect(socket.closed).toBe(true);
  });
});
