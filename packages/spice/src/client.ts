// Main-thread client for the SPICE Web Worker. Implements SpiceEngine by posting
// tagged requests and resolving responses by id.

import {
  SpiceError,
  type AberrationCorrection,
  type PositionResult,
  type SpiceEngine,
  type StateVector,
} from './index.ts';
import type { SpiceWorkerRequest, SpiceWorkerResponse } from './protocol.ts';

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

// Omit must distribute over the request union, otherwise it collapses to the
// shared keys (method) and drops each variant's payload fields.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export function createSpiceWorkerClient(worker: Worker): SpiceEngine {
  let nextId = 1;
  const pending = new Map<number, Pending>();

  worker.addEventListener('message', (ev: MessageEvent<SpiceWorkerResponse>) => {
    const res = ev.data;
    const p = pending.get(res.id);
    if (!p) return;
    pending.delete(res.id);
    if (res.ok) p.resolve(res.result);
    else p.reject(new SpiceError(res.error, res.shortMessage));
  });

  function send<T>(req: DistributiveOmit<SpiceWorkerRequest, 'id'>): Promise<T> {
    const id = nextId++;
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker.postMessage({ ...req, id } as SpiceWorkerRequest);
    });
  }

  return {
    furnsh: (name, bytes) => send<void>({ method: 'furnsh', name, bytes }),
    unload: (name) => send<void>({ method: 'unload', name }),
    kclear: () => send<void>({ method: 'kclear' }),
    ktotal: (kind = 'ALL') => send<number>({ method: 'ktotal', kind }),
    str2et: (utc) => send<number>({ method: 'str2et', utc }),
    et2utc: (et, format, precision) => send<string>({ method: 'et2utc', et, format, precision }),
    utc2et: (utc) => send<number>({ method: 'utc2et', utc }),
    spkpos: (target, et, frame, abcorr: AberrationCorrection, observer) =>
      send<PositionResult>({ method: 'spkpos', target, et, frame, abcorr, observer }),
    spkezr: (target, et, frame, abcorr: AberrationCorrection, observer) =>
      send<StateVector>({ method: 'spkezr', target, et, frame, abcorr, observer }),
    tkvrsn: () => send<string>({ method: 'tkvrsn' }),
  };
}
