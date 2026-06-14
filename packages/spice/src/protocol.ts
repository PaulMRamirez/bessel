// Worker message protocol between the main thread and the SPICE Web Worker.
// Requests are tagged by method; responses carry the matching id.

import type { AberrationCorrection, PositionResult, StateVector } from './index.ts';

export type SpiceWorkerRequest =
  | { id: number; method: 'furnsh'; name: string; bytes: Uint8Array }
  | { id: number; method: 'unload'; name: string }
  | { id: number; method: 'kclear' }
  | { id: number; method: 'ktotal'; kind: string }
  | { id: number; method: 'str2et'; utc: string }
  | { id: number; method: 'et2utc'; et: number; format: string; precision: number }
  | { id: number; method: 'utc2et'; utc: string }
  | {
      id: number;
      method: 'spkpos';
      target: string;
      et: number;
      frame: string;
      abcorr: AberrationCorrection;
      observer: string;
    }
  | {
      id: number;
      method: 'spkezr';
      target: string;
      et: number;
      frame: string;
      abcorr: AberrationCorrection;
      observer: string;
    }
  | { id: number; method: 'tkvrsn' };

export type SpiceWorkerResultMap = {
  furnsh: void;
  unload: void;
  kclear: void;
  ktotal: number;
  str2et: number;
  et2utc: string;
  utc2et: number;
  spkpos: PositionResult;
  spkezr: StateVector;
  tkvrsn: string;
};

export type SpiceWorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string; shortMessage?: string };
