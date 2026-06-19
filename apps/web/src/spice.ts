// Constructs the SPICE worker and a main-thread client. The worker carries
// CSPICE-WASM, so geometry and kernel loading stay off the main thread. The client
// is a SpiceComputeEngine, so it also runs F3 batched/cancellable evalSeries jobs in
// one round-trip. Heavy multi-core sweeps use createSpiceWorkerPool over several
// workers; normal rendering keeps the single client to avoid N-fold kernel loading.
import { createSpiceWorkerClient, type SpiceComputeEngine } from '@bessel/spice';

export function connectSpice(): SpiceComputeEngine {
  const worker = new Worker(new URL('./spice.worker.ts', import.meta.url), { type: 'module' });
  return createSpiceWorkerClient(worker);
}
