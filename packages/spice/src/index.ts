// @bessel/spice: a typed, promise-based API over CSPICE-WASM running in a Web
// Worker. Phase 0 implements the engine and the worker transport; this module
// is the public surface the renderer and geometry layers call.

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface StateVector {
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly lightTime: number;
}

export interface PositionResult {
  readonly position: Vec3;
  readonly lightTime: number;
}

export type AberrationCorrection =
  | 'NONE'
  | 'LT'
  | 'LT+S'
  | 'CN'
  | 'CN+S'
  | 'XLT'
  | 'XLT+S'
  | 'XCN'
  | 'XCN+S';

/** The minimal SPICE surface the renderer needs (SPEC 5.1). */
export interface SpiceEngine {
  furnsh(name: string, bytes: Uint8Array): Promise<void>;
  unload(name: string): Promise<void>;
  kclear(): Promise<void>;
  ktotal(kind?: string): Promise<number>;

  str2et(utc: string): Promise<number>;
  et2utc(et: number, format: string, precision: number): Promise<string>;
  utc2et(utc: string): Promise<number>;

  spkpos(
    target: string,
    et: number,
    frame: string,
    abcorr: AberrationCorrection,
    observer: string,
  ): Promise<PositionResult>;
  spkezr(
    target: string,
    et: number,
    frame: string,
    abcorr: AberrationCorrection,
    observer: string,
  ): Promise<StateVector>;

  tkvrsn(): Promise<string>;
}

/** Located, typed SPICE error. Fail loudly (CLAUDE.md). */
export class SpiceError extends Error {
  constructor(
    message: string,
    readonly shortMessage?: string,
  ) {
    super(message);
    this.name = 'SpiceError';
  }
}

export type { SpiceWorkerRequest, SpiceWorkerResponse } from './protocol.ts';
export { createSpiceEngine, type SpiceEngineOptions } from './engine.ts';
export { createSpiceWorkerClient } from './client.ts';
export { installSpiceWorker, dispatchSpice, type SpiceWorkerScope } from './worker-core.ts';
