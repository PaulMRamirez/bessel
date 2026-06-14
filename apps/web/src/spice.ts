// Constructs the SPICE worker and a main-thread client. The worker carries
// CSPICE-WASM, so geometry and kernel loading stay off the main thread.
import { createSpiceWorkerClient, type SpiceEngine } from '@bessel/spice';

export function connectSpice(): SpiceEngine {
  const worker = new Worker(new URL('./spice.worker.ts', import.meta.url), { type: 'module' });
  return createSpiceWorkerClient(worker);
}
