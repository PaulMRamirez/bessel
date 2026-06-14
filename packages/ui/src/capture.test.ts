import { describe, it, expect } from 'vitest';
import { captureStill, startRecording, CaptureError } from './capture.ts';

describe('@bessel/ui capture', () => {
  it('resolves a still blob from toBlob', async () => {
    const canvas = { toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['x'])) } as unknown as HTMLCanvasElement;
    const blob = await captureStill(canvas);
    expect(blob).toBeInstanceOf(Blob);
  });
  it('rejects with CaptureError when toBlob yields null', async () => {
    const canvas = { toBlob: (cb: (b: Blob | null) => void) => cb(null) } as unknown as HTMLCanvasElement;
    await expect(captureStill(canvas)).rejects.toBeInstanceOf(CaptureError);
  });
  it('throws CaptureError when recording is unsupported', () => {
    const canvas = {} as HTMLCanvasElement;
    expect(() => startRecording(canvas)).toThrow(CaptureError);
  });
});
