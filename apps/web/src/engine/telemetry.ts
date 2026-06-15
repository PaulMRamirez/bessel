// Throttled, fire-and-forget store updates derived from SPICE. These are async
// (worker round-trips) and run on accumulator gates in the frame loop, so they
// never block rendering. Each guards against a disposed engine before writing.

import type { SpiceEngine } from '@bessel/spice';
import { computeReadouts } from '../readouts.ts';
import type { AppStore } from '../store/index.ts';

export function pushEpochLabel(
  spice: SpiceEngine,
  store: AppStore,
  et: number,
  isDisposed: () => boolean,
): void {
  void spice.et2utc(et, 'ISOC', 0).then((utc) => {
    if (!isDisposed()) store.setState({ epochLabel: utc });
  });
}

export function pushReadouts(
  spice: SpiceEngine,
  store: AppStore,
  focusName: string,
  et: number,
  isDisposed: () => boolean,
): void {
  // Geometry readouts for the focused body, relative to Cassini (observer -82).
  if (focusName === 'Cassini') return;
  void computeReadouts(spice, focusName, focusName, et, '-82').then((r) => {
    if (!isDisposed()) store.setState({ readouts: r });
  });
}
