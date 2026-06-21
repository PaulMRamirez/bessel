// Throttled, fire-and-forget store updates derived from SPICE. These are async
// (worker round-trips) and run on accumulator gates in the frame loop, so they
// never block rendering. Each guards against a disposed engine before writing.

import type { SpiceEngine } from '@bessel/spice';
import { computeReadouts } from '../readouts.ts';
import { computeBodyState } from '../body-state.ts';
import type { AppStore } from '../store/index.ts';

/** Format an epoch through SPICE in the store's active time system (never by naive
 *  arithmetic), so UTC and TDB are both correct. et stays TDB seconds. */
function formatEpoch(spice: SpiceEngine, store: AppStore, et: number): Promise<string> {
  return store.getState().timeSystem === 'TDB'
    ? spice.et2tdb(et, 0)
    : spice.et2utc(et, 'ISOC', 0);
}

export function pushEpochLabel(
  spice: SpiceEngine,
  store: AppStore,
  et: number,
  isDisposed: () => boolean,
): void {
  void formatEpoch(spice, store, et).then((s) => {
    if (!isDisposed()) store.setState({ epochLabel: s });
  });
}

export function pushBoundsLabels(
  spice: SpiceEngine,
  store: AppStore,
  lo: number,
  hi: number,
  isDisposed: () => boolean,
): void {
  // The window ends share the epoch label's formatting, so the scrub track shows
  // where the loaded window starts and stops in the active time system.
  void Promise.all([formatEpoch(spice, store, lo), formatEpoch(spice, store, hi)]).then(
    ([a, b]) => {
      if (!isDisposed()) store.setState({ boundsLabel: [a, b] });
    },
  );
}

export function pushReadouts(
  spice: SpiceEngine,
  store: AppStore,
  focusName: string,
  observerId: string | null,
  et: number,
  bodyFrames: ReadonlyMap<string, string>,
  isDisposed: () => boolean,
): void {
  // Geometry readouts for the focused body, relative to the mission spacecraft.
  // With no spacecraft observer (a neutral scene) there is nothing to measure
  // from, so the readouts stay n/a rather than showing a wrong value.
  if (!observerId) return;
  void computeReadouts(spice, focusName, focusName, et, observerId, bodyFrames).then((r) => {
    if (!isDisposed()) store.setState({ readouts: r });
  });
}

export function pushBodyState(
  spice: SpiceEngine,
  store: AppStore,
  target: string,
  center: string,
  frame: string,
  et: number,
  mu: number | null,
  isDisposed: () => boolean,
): void {
  // State vectors and osculating elements for the focused body about its center.
  // With no central GM (an unknown body) there is no orbit to report, so the panel
  // stays n/a rather than computing elements from a guessed mu.
  if (mu === null) {
    if (!isDisposed()) store.setState({ bodyState: null });
    return;
  }
  void computeBodyState(spice, target, center, frame, et, mu).then((s) => {
    // Drop a result whose frame the user has since switched away from: a late
    // in-flight computation from a prior tick must not flash old-frame numbers under
    // the new frame label (setStateFrame clears bodyState for the same reason).
    if (!isDisposed() && store.getState().stateFrame === frame) store.setState({ bodyState: s });
  });
}
