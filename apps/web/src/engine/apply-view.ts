// Apply a decoded ViewModel to the scene, clock, and store: reconstruct the
// epoch, camera, and selection. Shared by the inbound shared-URL path (bootstrap)
// and the saved-views feature so both reconstruct a view identically.

import type { SolarSystemScene } from '@bessel/scene';
import type { SpiceEngine } from '@bessel/spice';
import type { Clock } from '@bessel/timeline';
import type { ViewModel } from '@bessel/state';
import type { AppStore } from '../store/index.ts';

export async function applyViewModel(
  scene: SolarSystemScene,
  clock: Clock,
  spice: SpiceEngine,
  store: AppStore,
  view: ViewModel,
  isDisposed: () => boolean,
): Promise<void> {
  if (view.t) {
    const sharedEt = await spice.str2et(view.t.replace('Z', ''));
    if (isDisposed()) return;
    clock.setEpoch(sharedEt);
    store.setState({ et: sharedEt });
  }
  if (view.camera.target) scene.centerOn(view.camera.target);
  scene.setView(view.camera.azimuth, view.camera.elevation, view.camera.distance);
  store.setState({
    focus: view.camera.target ?? scene.focusBody,
    selection: view.selection,
  });
}
