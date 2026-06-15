// The async boot sequence: load kernels through pal-web, sample ephemerides over
// the demo window, construct the camera-relative scene, load the instrument FOV,
// and reconstruct any shared view from the URL fragment. It updates store status
// as it goes and returns the imperative core the engine drives each frame.
//
// In Phase F0.3 the scene construction here is replaced by the catalog-driven
// mission orchestrator; for now it preserves the Cassini-at-Saturn behavior.

import { parseCosmographiaCatalog } from '@bessel/catalog';
import cassiniCatalog from '@bessel/catalog/examples/cassini';
import { createWebPlatform } from '@bessel/pal-web';
import { INNER_SYSTEM, SolarSystemScene, loadSpacecraftModel, parseStarCatalog } from '@bessel/scene';
import type { SpiceEngine } from '@bessel/spice';
import { Clock } from '@bessel/timeline';
import { decodeView } from '@bessel/state';
import cassiniGltf from '../assets/cassini.gltf?raw';
import brightStars from '../assets/bright-stars.json';
import { connectSpice } from '../spice.ts';
import { KERNEL_ORDER, KERNEL_URLS } from '../kernels.ts';
import { sampleEphemeris, positionAt, trajectoryOf, type EphemerisTable } from '../sampler.ts';
import {
  CASSINI_ISS_WAC,
  loadInstrumentFov,
  type InstrumentFov,
} from '../instruments.ts';
import type { AppStore } from '../store/index.ts';
import { STEPS, FOCUS_DISTANCE } from './constants.ts';

export interface EngineCore {
  scene: SolarSystemScene;
  clock: Clock;
  table: EphemerisTable;
  spice: SpiceEngine;
  fov: InstrumentFov | null;
}

export async function bootScene(
  canvas: HTMLCanvasElement,
  store: AppStore,
  isDisposed: () => boolean,
): Promise<EngineCore> {
  const spice = connectSpice();
  store.setState({ status: 'Loading kernels' });
  const platform = await createWebPlatform({ kernelUrls: KERNEL_URLS });
  for (const name of KERNEL_ORDER) {
    const handle = await platform.kernels.resolve(name);
    const bytes = await platform.kernels.read(handle);
    await spice.furnsh(name, bytes);
  }

  const sc = parseCosmographiaCatalog(cassiniCatalog);
  const rawEt0 = await spice.str2et(sc.startTime ?? '2004-06-21T00:00:00');
  const rawEt1 = await spice.str2et(sc.endTime ?? '2004-08-23T00:00:00');
  // The catalog window coincides with the Cassini SPK coverage boundaries; inset
  // slightly so interpolation always has data at the sampled epochs.
  const margin = 1800;
  const et0 = rawEt0 + margin;
  const et1 = rawEt1 - margin;

  store.setState({ status: 'Sampling ephemerides' });
  const bodies = [
    ...INNER_SYSTEM.map((p) => ({ name: p.name, spiceId: p.spiceId })),
    { name: 'Cassini', spiceId: sc.spiceId },
  ];
  const table = await sampleEphemeris(spice, bodies, et0, et1, STEPS);
  // Cassini orbit sampled in Saturn's frame so the trajectory shows the orbit
  // rather than Saturn's heliocentric drift.
  const orbit = await sampleEphemeris(
    spice,
    [{ name: 'Cassini', spiceId: sc.spiceId }],
    et0,
    et1,
    STEPS,
    sc.center,
  );

  const scene = new SolarSystemScene(canvas);
  scene.setBodies(INNER_SYSTEM);
  scene.setSpacecraft('Cassini');
  scene.setTrajectory(trajectoryOf(orbit, 'Cassini'), 'Saturn');

  // Star field, Saturn rings, body-fixed axis triad, and the GLTF spacecraft.
  try {
    scene.setStarField(parseStarCatalog(brightStars));
  } catch (err) {
    console.error('star field failed', err);
  }
  const saturnRot = await spice.pxform('IAU_SATURN', 'J2000', et0);
  scene.setRings('Saturn', 74500, 140220, saturnRot);
  scene.setAxisTriad('saturn-axes', 'Saturn', saturnRot, 120000);
  // Atmosphere shell around Saturn (toggled via the settings panel).
  const sunDir = positionAt(table, 'Saturn', et0);
  scene.setAtmosphere('Saturn', 60268, 66000, {
    sunDirection: [-sunDir[0], -sunDir[1], -sunDir[2]],
  });
  scene.setAtmosphereVisible(false);
  // Direction to the Sun from Cassini (the Sun sits at the heliocentric origin).
  const sc0 = positionAt(table, 'Cassini', et0);
  scene.setDirectionVectors(
    'Cassini',
    [{ label: 'to-Sun', dirKm: [-sc0[0], -sc0[1], -sc0[2]], color: 0xffd27f }],
    200000,
  );
  try {
    scene.setSpacecraftModel(await loadSpacecraftModel(cassiniGltf, 200));
  } catch (err) {
    console.error('spacecraft model load failed', err);
  }

  scene.centerOn('Saturn');
  scene.setView(0.6, 0.35, FOCUS_DISTANCE['Saturn'] ?? 0.7);

  const fov = await loadInstrumentFov(spice, CASSINI_ISS_WAC).catch((err: unknown) => {
    console.error('getfov failed', err);
    return null;
  });
  store.setState({ fovOk: !!fov });

  const clock = new Clock(et0, store.getState().rate);
  store.setState({ bounds: [et0, et1], et: et0 });

  await applySharedView(scene, clock, spice, store, isDisposed);

  return { scene, clock, table, spice, fov };
}

// Reconstruct a shared view from the URL fragment, if present.
async function applySharedView(
  scene: SolarSystemScene,
  clock: Clock,
  spice: SpiceEngine,
  store: AppStore,
  isDisposed: () => boolean,
): Promise<void> {
  if (window.location.hash.length <= 1) return;
  try {
    const view = decodeView(window.location.hash);
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
  } catch (err) {
    console.error('failed to apply shared view', err);
  }
}
