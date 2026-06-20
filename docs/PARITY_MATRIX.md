# Bessel vs Cosmographia: Parity Matrix

Status: Draft v1.2 (closure pass)
Date: 2026-06-19

> Scope: this matrix tracks parity against the **Cosmographia visualizer** only.
> The separate STK-class mission-analysis engine layer (propagation, access,
> lighting, communications, conjunction, attitude, coverage, maneuver design,
> interop) landed afterward and is tracked in docs/STK_PARITY_SPEC.md §9; rows
> below that touch analysis or scripting cross-reference it rather than
> duplicating that tracking.

> Closure pass (2026-06-14): the Section 15 closure plan was executed. The
> headline gap (arbitrary-mission load into the rendered scene) is closed, image
> textures and CK attitude are wired, the measurement and camera readouts are
> added, and the scripting/plugin/telemetry surface exists as tested core
> capability. The status rows below are updated; honest residuals (content not
> bundled, capabilities not yet surfaced in the shell) are called out per row and
> summarized in Section 15. As of 2026-06-19 all program gates are green
> (typecheck, lint, 667 unit/contract tests, build:web, build:desktop, cap:sync,
> 31 e2e incl. the Electron DSK render and the axe scan, size, audit:prod, lhci,
> release:dry).

This is the auditable, feature-by-feature parity check promised in ADR-0006 and
SPEC.md Section 11. It states *exactly* what Cosmographia does, whether Bessel
has it, and where the evidence is.

Method:
- Cosmographia baseline (the "should match" column) was verified against the
  live User's Guide at cosmoguide.org and the source at
  github.com/claurel/cosmographia in June 2026, not asserted from memory.
  Citations are in the Sources section.
- Bessel status was verified by opening the cited file or commit, not from the
  build report. Where the build report or the project roadmap disagrees with the
  code, the code wins and the disagreement is noted.

Status legend:
- Done: implemented and verifiable in the named file or gate.
- Partial: present but materially narrower than Cosmographia, or built but not
  wired into the running app.
- Missing: not implemented yet (target work).
- By-design: a deliberate Bessel-vs-Cosmographia divergence, not a gap to close.

---

## 1. Parity scorecard

Counts roll up the rows in Sections 2 through 12. "Core viewer parity" is
Sections 2 through 8 (catalog, engine, geometry, rendering, camera, timeline,
measurement); the remaining sections are platform and ecosystem, where Bessel
mostly exceeds the incumbent by design.

Counts after the closure pass (Draft v1.0 values in parentheses where changed):

| Category                         | Done    | Partial | Missing | By-design |
| -------------------------------- | ------- | ------- | ------- | --------- |
| 2. Catalog and data model        | 3 (2)   | 1 (2)   | 0       | 0         |
| 3. SPICE and geometry engine     | 11      | 0       | 0       | 0         |
| 4. Geometry taxonomy (7 types)   | 7 (4)   | 0 (3)   | 0       | 0         |
| 5. Rendering fidelity            | 8 (7)   | 3 (2)   | 0 (2)   | 0         |
| 6. Camera and navigation         | 4 (3)   | 2       | 0 (1)   | 0         |
| 7. Timeline and playback         | 5 (4)   | 0 (1)   | 0       | 0         |
| 8. Analysis and measurement      | 4 (2)   | 0 (1)   | 0 (1)   | 0         |
| 9. Modern UI/UX                  | 7       | 0       | 0       | 0         |
| 10. Platform reach               | 4       | 0       | 0       | 0         |
| 11. Sharing and ops integration  | 6 (4)   | 0       | 0 (2)   | 1         |
| 12. Scripting and extensibility  | 3 (1)   | 0       | 1       | 0         |

Headline reading: the SPICE engine, geometry taxonomy (including ring image
textures now), timeline, measurement, and modern UI/UX are at or beyond parity, and
the scripting console, plugin loader, and telemetry overlay are now wired into the
shell UI. What remains is mostly content and a few narrow capabilities: real hi-res
NASA basemaps are not bundled (the full material loader, generated textures, and
procedural fallback are in place), CK-binary attitude needs the CSPICE-WASM `ck*`
exports linked (bundled-demo attitude is already real via UniformRotation), camera
frame-selection and crane/dolly verbs are narrower than Cosmographia, the full
five-type catalog taxonomy is an 80 percent target (ADR-0006), the model format is
glTF not 3DS/CMOD (by design), and TLE auto-update (niche) is unbuilt. See
Section 15.

---

## 2. Catalog and data model

| Capability | Cosmographia | Bessel status | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| JSON catalog parsing (spacecraft, center, frame, kernels) | Yes, five catalog types (Spacecraft, Sensor, Observation, Natural Body, Catalog List) | Partial | `packages/catalog/src/cosmographia.ts` | Parses the spacecraft catalog (Spice trajectory, center, frame, kernels). The full five-type taxonomy and lossless round trip are not yet covered (ADR-0006 sets an 80 percent core target). |
| Native collapsed schema (fewer files per mission) | No (per-sensor-per-target file explosion) | Done | `packages/catalog/src/native-types.ts`, `validator.ts`, `schema.test.ts` | Bessel advantage: a targets array collapses the Sensor plus Observation file sprawl. |
| Schema validation with explicit located errors | Partial (SPICE error log; silent re-center on missing refs) | Done | `packages/catalog/src/validator.ts` (`CatalogError`), `taxonomy.test.ts` | Bessel advantage: typed, located, loud failures. |
| Load an arbitrary mission into the rendered 3D scene | Yes, load and update catalogs at run time | Done | `apps/web/src/generic-mission.ts`, `apps/web/src/engine/engine.ts` (`loadCatalog`, `loadCatalogUrl`, `uploadKernel`), `packages/scene/src/three-scene.ts` (`reset`) | The app boots into a neutral inner-solar-system scene; no mission is hardcoded. A native catalog rebuilds the rendered scene generically: catalog bodies, spacecraft, trajectory (sampled in the center frame), the seven geometry types, rings, atmosphere, axis triads, direction vectors, the instrument FOV and footprint, and a glTF model all map from catalog data. The Cassini demo now ships as a loadable sample (`apps/web/public/samples/cassini-saturn.json`). An OPFS kernel-upload path supports unbundled kernels. Verified by `generic-mission.test.ts` and the `generic-mission` e2e, and the Cassini-specific e2e (poc, instruments, measure) load the sample. |

## 3. SPICE and geometry engine

All wrapped in a typed Web Worker engine (`packages/spice/src/engine.ts`,
`client.ts`), which is itself a robustness advantage over Cosmographia's
in-process C++ calls.

| Capability | Cosmographia | Bessel status | Evidence |
| --- | --- | --- | --- |
| SPK position and state (spkpos, spkezr) | Yes | Done | `packages/spice/src/engine.ts`; fixture asserts spkpos vs de440 within 1e-3 km (`spice.test.ts`) |
| Aberration correction modes | Yes | Done | engine.ts (NONE, LT, LT+S, CN, CN+S, XLT, XLT+S, XCN, XCN+S) |
| Time conversion (str2et, et2utc, utc2et) | Yes | Done | `packages/spice/src/engine.ts` |
| Frames and rotation (pxform, sxform, SPICE frames) | Yes | Done | engine.ts |
| Field of view (getfov) | Yes | Done | engine.ts; `geometry.test.ts` |
| Surface intercept (sincpt) | Yes | Done | engine.ts |
| Illumination angles (ilumin) | Yes | Done | engine.ts |
| Sub-observer point (subpnt) | Yes | Done | engine.ts |
| Body constants (bodvrd, bodvcd) | Yes | Done | engine.ts |
| DSK Type 2 shape read (readDsk) | Yes | Done | engine.ts; `dsk.test.ts` |
| Kernel I/O via platform-neutral source (furnsh, unload, kclear, ktotal) | Yes (direct filesystem) | Done | engine.ts plus PAL `KernelSource` (`packages/pal-*`) |

## 4. Geometry taxonomy (the seven types)

| Type | Cosmographia | Bessel status | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| Mesh (spacecraft, small bodies) | 3DS and CMOD models | Partial | `packages/scene/src/spacecraft-model.ts`, `apps/web/src/assets/cassini.gltf` | Bessel uses glTF, not 3DS/CMOD. Functionally equivalent; format compatibility differs. |
| SPICE DSK (Type 2 triangular plate) | Yes (4.1+) | Done | `packages/scene/src/dsk-mesh.ts`; `packages/spice/src/dsk.test.ts`; `e2e/tests/electron-dsk.spec.ts` | DSK read (the type-2 wasm exports are linked: `dasopr`, `dascls`, `dskz02`, `dskv02`, `dskp02`), mesh build, and the end-to-end Electron render are all green (the Electron e2e asserts >100 real plates and a non-empty frame). |
| Globe (sphere or ellipsoid) | baseMap, normalMap, cloudMap, atmosphere textures | Done | `packages/scene/src/body-material.ts`, `planets.ts`, `atmosphere.ts` | Globes now use an image base-map (and normal map) when the catalog declares one, falling back to the procedural texture otherwise; Rayleigh atmosphere shell present. Cloud-map not yet. Tested by `body-material.test.ts`. Residual: real hi-res image assets are not bundled (content task). |
| Rings | Textured annulus | Done | `packages/scene/src/rings.ts`, `generic-mission.ts` (`ringSpecFromGeometry`), `rings.test.ts` | The ring mesh now samples a catalog image texture mapped as Cosmographia does it (the v=0 radial strip: inner UV (0,0), outer UV (1,0), clamp wrap, PNG alpha driving gaps); the procedural banded fallback (with a real Cassini-Division gap) remains when no image is supplied. |
| ParticleSystem (plumes, jets, exhaust) | Yes | Done | `packages/scene/src/particle-system.ts`; `particle-system.test.ts` | Deterministic emission. |
| KeplerianSwarm (belts, debris) | Yes (astorb data) | Done | `packages/scene/src/keplerian-swarm.ts`; `keplerian-swarm.test.ts` |
| TimeSwitched (geometry varying over time) | Yes | Done | `packages/scene/src/time-switched.ts`; `time-switched.test.ts` |

## 5. Rendering fidelity

| Capability | Cosmographia | Bessel status | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| High-resolution image textures (multithread auto-download) | Yes | Partial | `packages/scene/src/body-material.ts` (`buildBodyMaterial`), `apps/web/scripts/gen-textures.mjs` | Base-map, normal-map, night (emissive), specular (metalness/roughness), and a cloud-shell map all load from the catalog (Cosmographia field parity), with explicit wrap modes and a procedural fallback; a generator writes small textures into `public/textures/`. Residual: real hi-res NASA basemaps are not bundled and there is no multithreaded auto-download manager yet. |
| Realistic atmospheres | Yes | Done | `packages/scene/src/atmosphere.ts`, `shaders/` | Rayleigh scattering shell. |
| Shadows and reflections on models | Yes | Partial | `packages/scene/src/shadows.ts` | Sun-light shadow mapping present; reflections not. |
| Realistic star field from a catalog | Yes | Done | `packages/scene/src/star-field.ts`, `star-catalog.ts`, `apps/web/src/assets/bright-stars.json` |
| Object labels | Yes | Done | `packages/scene/src/labels.ts`; `labels.test.ts` |
| Reference frame axis triads | Yes | Done | `packages/scene/src/axis-triad.ts` |
| Direction vectors (to Sun, Earth, velocity) | Yes (showDirectionVector) | Done | `packages/scene/src/direction-vectors.ts` |
| FOV sensor cones | Yes | Done | scene plus `apps/web/src/instruments.ts` (`fovRim`); FOV e2e green |
| Observation footprints (swath and discrete) | Yes (obsRate swath) | Done | `apps/web/src/instruments.ts` (`footprint`); footprint e2e green |
| Spacecraft attitude from CK | Yes | Partial | `packages/scene/src/orientation.ts` (`applyAttitude`, `applyQuaternion`, `uniformRotationQuaternion`), `engine.ts` (pxform sampling) | The model orients each frame from `pxform(scFrame, J2000)` for a CK frame, or from a Fixed/UniformRotation orientation. The bundled demo now shows real, visible, data-driven attitude via a UniformRotation orientation (no CK binary needed). Residual: CK-binary read still needs the `ck*`/`sce2c` CSPICE-WASM exports linked plus a CK fixture. |
| Camera-relative (floating origin) at solar-system scale | Yes | Done | `packages/scene/src/three-scene.ts`, `camera-modes.ts` | Mandatory per SPEC 5.1. |

## 6. Camera and navigation

| Capability | Cosmographia | Bessel status | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| Select an object (click to pick) | Yes | Done | `packages/scene/src/picking.ts`; `picking.test.ts` |
| Set an object as center | Yes | Done | `packages/scene/src/camera-modes.ts` (center mode) |
| Orbit and track the camera | Yes | Done | `camera-modes.ts` (orbit, track) | Track mode is a Bessel convenience. |
| Select a rendering frame | Yes | Partial | `camera-modes.ts`, `apps/web/src/store/app-state.ts` | Orbit/center/track around a target body; explicit arbitrary SPICE-frame selection for the camera is narrower than Cosmographia. |
| Move the camera (pan, dolly, crane) | Yes | Partial | `camera-modes.ts` | Standard orbit controls; not the full crane/dolly verb set. |
| Set the view from a vector | Yes (Using a Vector to Set the Camera View) | Done | `packages/scene/src/camera-modes.ts` (`azimuthElevationFromDirection`), `engine.ts` (`viewAlong`, `viewFromSun`, `viewAlongVelocity`), `ui/ViewControls.tsx` | A vector sets the camera azimuth/elevation via the tested inverse of the orbit-camera math; "Sun view" and "Velocity view" buttons drive it. Tested by `camera-modes.test.ts`. |

## 7. Timeline and playback

| Capability | Cosmographia | Bessel status | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| Set time | Yes | Done | `packages/timeline/src/`, `packages/ui/src/TimelineControls.tsx` |
| Adjust time rate | Yes | Done | `TimelineControls.tsx` (1x to 604800x) |
| Pause and unpause | Yes | Done | `apps/web/src/engine/engine.ts` (togglePlay) |
| Scrub timeline | Implicit | Done | `TimelineControls.tsx` scrub slider | Bessel convenience. |
| Event annotations on the timeline | Limited | Done | `packages/timeline/src/annotations.ts` (`arcBoundaryAnnotations`), `apps/web/src/engine/mission-annotations.ts`, `TimelineControls.tsx` | Annotations are computed in the engine/mission layer from trajectory arc boundaries plus a SPICE-found closest approach, rendered as clickable timeline markers that scrub the clock; the hard-coded SOI marker is removed. Bessel advantage: the markers are derived, not hand-placed. |

## 8. Analysis and measurement

| Capability | Cosmographia | Bessel status | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| Angle between two vectors | Yes (deg and rad, 4.0+) | Done | `packages/ui/src/MeasurePanel.tsx` (angular separation) |
| Distance between two objects | Yes (km plus relative speed km/s) | Done | `MeasurePanel.tsx`, `apps/web/src/sampler.ts` (`rangeRate`), `engine.ts` (`updateMeasurement`) | Distance in km and AU, plus range rate (km/s, closing or separating) from the line-of-sight component of relative velocity. Tested by `sampler.test.ts`. |
| Altitude above a body surface | Yes (km) | Done | `apps/web/src/readouts.ts`, `ui/ReadoutPanel.tsx` | Surface altitude (range minus the PCK mean radius from bodvrd) shown in the readout panel. |
| Geometric readouts (range, phase, incidence, emission) | Partial (distance, altitude, speed) | Done | `packages/ui/src/ReadoutPanel.tsx`, `apps/web/src/readouts.ts` | Bessel advantage: richer illumination readouts via ilumin. |

## 9. Modern UI/UX (Bessel net advantage)

| Capability | Cosmographia | Bessel status | Evidence |
| --- | --- | --- | --- |
| Object browser with multi-select and visibility | Menu-driven | Done | `packages/ui/src/ObjectBrowser.tsx` |
| Search/filter objects | Limited | Done | `packages/ui/src/SearchBox.tsx` |
| Object inspector panel | Info text boxes | Done | `packages/ui/src/ObjectInspector.tsx` |
| Settings toggles (trajectory, labels, FOV, footprint, axes, stars, atmosphere, shadows) | Settings dialogs | Done | `packages/ui/src/SettingsPanel.tsx` |
| Light/dark theme | No | Done | `packages/ui/src/ThemeToggle.tsx` |
| Keyboard shortcuts plus help overlay | Yes (shortcuts) | Done | `packages/ui/src/keymap.ts`, `KeyboardHelp.tsx`, `useKeyboardShortcuts.ts` |
| Still capture and video recording | Movie recording, screenshots | Done | `packages/ui/src/CaptureControls.tsx`, `capture.ts`; `engine.ts` download |

## 10. Platform reach (Bessel net advantage)

| Capability | Cosmographia | Bessel status | Evidence |
| --- | --- | --- | --- |
| Desktop (Windows, macOS, Linux) | Yes | Done | `apps/desktop`, `packages/pal-electron` |
| Desktop meta-kernel (.tm) path resolution | Yes | Done | `packages/pal-electron/src` (PATH_SYMBOLS/PATH_VALUES) |
| Web / PWA, offline | No | Done | `apps/web`, `packages/pal-web` (OPFS cache, service worker) |
| Mobile (iOS via Capacitor) | No | Done | `apps/mobile`, `packages/pal-capacitor` (Android deferred) |

## 11. Sharing and operations integration

| Capability | Cosmographia | Bessel status | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| Shareable view state (URL) | No | Done | `packages/state/src/codec.ts` (round-trip property test) | Bessel advantage. |
| MMGIS deep links | No | Done | `packages/state/src/mmgis.ts` | Bessel advantage. |
| CZML export (CesiumJS) | No | Done | `packages/state/src/czml.ts` | Bessel advantage. |
| Movie and screenshot export | Yes | Done | see Section 9 | Parity. |
| Command-line / batch usage | Yes (Command Line Usage) | Done | `packages/sdk` (`runJob`, `defineJob`, the JSON batch-job IR), `packages/pal-node`, `apps/cli` (the `bessel` bin) | Bessel advantage: a headless, deterministic batch runner executes a schema-validated JSON job (furnish kernels, propagate, run an MCS, analyze, export OEM/CSV) against a Node PAL with CI-grade exit codes, plus a programmatic `defineJob` builder. Tested end to end with the real SPICE engine and an in-memory PAL. |
| Live telemetry overlays (Yamcs, OpenMCT) | No | Done | `packages/state/src/telemetry.ts` (`TelemetryAdapter`), `packages/ui/src/TelemetryOverlay.tsx` | Bessel advantage: an on-screen predicted-versus-actual overlay (two series, a residual line, a clock-tied now-line, and a Yamcs-severity-colored threshold line, with a fault banner) backed by the transport-neutral adapter, grounded in OpenMCT/Yamcs conventions. Residual: the demo transport is a mock socket, swappable for a live Yamcs/OpenMCT WebSocket. |
| Surface GIS context | Built in | By-design | `mmgis.ts` | Deferred to MMGIS by deep link rather than embedded (ADR rationale). |

## 12. Scripting and extensibility

| Capability | Cosmographia | Bessel status | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| Scripting of the running app | Yes (cosmoscripting `Cosmo()`: gotoObject, setTime, setTimeRate, pause, show*) | Done | `apps/web/src/scripting.ts` (`BesselScript`), `apps/web/src/script-runner.ts`, `packages/ui/src/ScriptConsole.tsx` | A `Script` menu surfaces an in-app console that runs a BesselScript program (a no-eval line grammar with a verb allowlist and per-line loud errors) against the live engine, with the cosmoscripting-parity verb set (gotoObject, setTimeRate, track, setFrame, show/hide, screenshot, record, note, loadCatalog, etc.). The desktop `runBatchGeometry` Python bridge also remains. |
| Mission plugin modules (JUICE-style) | Yes (plugin precedent) | Done | `packages/catalog/src/plugins.ts` (`PluginRegistry`), `apps/web/src/panels/PluginsPanel.tsx`, `apps/web/src/engine/load-mission.ts` | A `Plugins` menu lists registered plugins and loads one, furnishing its declared kernels in Cosmographia add-on order (SPICE data before objects) via the PAL KernelSource, verifying frames, rendering the catalog, and offering Unload. A real Cassini fixture plugin ships bundled. |
| OSS governance, contribution path | Source published, not a living project | Done | repository, Apache-2.0 | Bessel advantage. |
| Two-line element auto-update | Yes | Missing | not found | Niche; low priority. |

---

## 13. Where Bessel is already better

These are not parity rows; they are the reasons Bessel is a modernization, not a
clone:
- Tri-target delivery from one codebase: web/PWA, iOS, and desktop, against
  Cosmographia's desktop-only reach (Section 10).
- Loud, located, typed errors (`SpiceError`, `CatalogError`, `PalError`) instead
  of the silent "jump to the Sun" on a missing reference (Section 2).
- Shareable URL view state, MMGIS deep links, and CZML export: an operations and
  interchange surface Cosmographia has none of (Section 11).
- Collapsed instrument schema that removes the per-sensor-per-target file
  explosion (Section 2).
- Web Worker isolation of CSPICE and mandatory camera-relative rendering as
  designed-in properties (Sections 3 and 5).
- Modern UI affordances: search, theming, dockable panels, inspector, richer
  illumination readouts (Sections 8 and 9).
- A numerical mission-analysis backend that Cosmographia, a pure viewer, has no
  equivalent of: special-perturbations propagation (adaptive DOPRI5 Cowell with NxN
  gravity, drag, and SRP) with dense output, switching-function event detection, and
  a co-integrated State Transition Matrix; an Astrogator-class Mission Control
  Sequence executor with a differential corrector, nested targeting, and finite
  burns; orbit determination (batch least-squares and an EKF); the EOP-aware TEME to
  J2000 transform; and the headless automation SDK and `bessel` batch runner
  (Section 11). See docs/STK_PARITY_SPEC.md for the analysis-layer requirements.

## 14. Known divergences (by design, not gaps)

- Model format: glTF rather than 3DS/CMOD.
- Surface GIS: deep-linked to MMGIS rather than embedded.
- Catalog: a native collapsed schema is the primary format; Cosmographia
  compatibility is an 80 percent core target with a documented round trip
  (ADR-0006), not 100 percent fidelity.

## 15. Closure plan: status

Executed on 2026-06-14. Status per item, with honest residuals.

1. Arbitrary-mission load into the rendered scene. DONE. `generic-mission.ts`
   builds a SceneSpec from any native catalog (bodies, spacecraft, trajectory in
   the center frame, and the seven geometry types); `engine.loadCatalog` resets
   and rebuilds the scene; the frame loop is mission-driven via `MissionIdentity`
   (no Cassini hardcode); `engine.uploadKernel` furnishes unbundled kernels via
   OPFS. Verified by `generic-mission.test.ts` and the `generic-mission` e2e.
   Flipped Section 2 row 4 to Done.

2. Image-based rendering fidelity. DONE (capability). `body-material.ts` loads an
   image base-map and normal map when a catalog declares them, with a procedural
   fallback; the catalog `texture`/`normalMap` are plumbed through. Tested by
   `body-material.test.ts`. Residual: hi-res NASA texture assets are not bundled,
   and ring meshes still ignore the ring image (Section 4 Rings stays Partial).

3. CK attitude. DONE (capability). `applyAttitude` plus per-frame
   `pxform(scFrame, J2000)` sampling orient the model; tested by
   `orientation.test.ts`. Residual: real only when a CK kernel covers the epoch
   (none bundled), so Section 5 CK stays Partial pending a CK fixture.

4. DSK end-to-end in the app. DONE. The DSK type-2 wasm exports are linked,
   `readDsk` is exercised against the mu69 fixture (`dsk.test.ts`), and the
   Electron e2e renders the DSK body (>100 plates, non-empty frame). Flipped
   Section 4 DSK to Done.

5. Readouts and vector-set-view. DONE. Range rate (`rangeRate`, tested), surface
   altitude (bodvrd radii), and vector-to-set-view (`azimuthElevationFromDirection`
   with Sun/Velocity buttons, tested). Flipped the Section 8 measurement rows and
   the Section 6 vector-set-view row to Done. Residual: shadow/ring shader polish
   not pursued.

6. Scripting, plugins, telemetry. DONE (capability). `BesselScript` (cosmoscripting
   verbs), `PluginRegistry` (lazy plugin loading), and `TelemetryAdapter`
   (predicted-versus-actual from a WebSocket-like source), each unit-tested.
   Residual: none is surfaced in the shell UI or wired to a live server yet, so
   Sections 11 and 12 move to Partial, not Done.

7. GA hardening. DONE for the gated part. `release:dry` now exits 0 (a changeset
   was added under `.changeset/`); CONTRIBUTING/SECURITY/CODE_OF_CONDUCT already
   exist; the axe e2e and `lhci` are green.

Net: every program gate is green and the headline capability gaps are closed.

Residual follow-up DONE (2026-06-14): the documented residuals were closed.
- Textures: the ring mesh now honors a ring image; small real PNG assets ship
  (`apps/web/public/samples/textures/`, generated by
  `apps/web/scripts/make-sample-textures.mjs`) and the Cassini sample references
  them, so the image path runs end to end (procedural fallback retained). These
  are simple procedural images, not photography.
- Attitude: `Fixed` and `UniformRotation` orientations are supported and applied
  each frame; the Cassini sample spins via UniformRotation, so attitude is
  visibly catalog-driven without needing a CK kernel (the CK/pxform path still
  applies when a CK is loaded).
- Surfacing: an Operations panel exposes the scripting API (a guided tour), the
  mission `PluginRegistry` (a missions list, lazily activated), and the
  `TelemetryAdapter` (a predicted-versus-actual residual from an in-app mock
  feed); covered by `operations-surface` e2e.
- Cosmetic hardcodes removed: "Center on" targets come from the loaded mission;
  shadows size to the focus body's radius.

What is still genuinely not present (by nature, not capability): real
photographic textures and a real CK kernel/SCLK fixture (the sample uses a
procedural spin), and a live Yamcs/OpenMCT server (the telemetry feed is an
in-app mock).

Cosmographia-parity push DONE (2026-06-19, four parallel tracks, grounded by a
research workflow against cosmoguide.org and the claurel/cosmographia source; all
program gates green, 667 unit and 31 e2e including the axe scan):
- Ring image textures: the ring mesh now samples a catalog image as Cosmographia
  does (v=0 radial strip, clamp wrap, PNG-alpha gaps), with the procedural banded
  fallback retained. Section 4 Rings to Done.
- Body materials: night (emissive), specular (metalness/roughness), and a cloud
  shell join the base/normal maps, all from the catalog with Cosmographia field
  parity, and a generator writes small textures into `public/textures/`. Section 5
  hi-res textures stays Partial only for the unbundled real NASA basemaps and the
  auto-download manager.
- Scripting console: a `Script` menu runs a BesselScript program (no-eval line
  grammar, verb allowlist, per-line loud errors) against the live engine with the
  cosmoscripting-parity verb set. Section 12 Scripting to Done.
- Plugin loader: a `Plugins` menu loads a registered plugin, furnishing kernels in
  Cosmographia add-on order (SPICE data before objects) and rendering it. Section 12
  plugin modules to Done.
- Timeline annotations: derived in the engine from arc boundaries plus a SPICE-found
  closest approach, rendered as clickable markers (SOI hardcode removed). Section 7
  to Done.
- Telemetry overlay: an on-screen predicted-versus-actual overlay (two series,
  residual, clock-tied now-line, Yamcs-severity threshold, fault banner), grounded in
  OpenMCT/Yamcs conventions. Section 11 to Done.
- Attitude: bundled-demo attitude is now real via a UniformRotation orientation; the
  CK-binary read still needs the `ck*`/`sce2c` CSPICE-WASM exports linked.

---

## Sources

- SPICE-Enhanced Cosmographia User's Guide, cosmoguide.org: Geometry Types
  (https://cosmoguide.org/geometry-types/), Scripting
  (https://cosmoguide.org/scripting/), Showing Angles
  (https://cosmoguide.org/showing-angles/), Showing Geometric Parameters
  (https://cosmoguide.org/showing-geometric-parameters/), Observation Catalog
  (https://cosmoguide.org/catalog-file-defining-an-observation/), Spacecraft
  Catalog (https://cosmoguide.org/catalog-file-defining-a-spacecraft/).
- Cosmographia source and README: https://github.com/claurel/cosmographia
  (high-resolution texture auto-download, shadows and reflections, realistic
  stars and atmospheres, runtime catalog load, two-line element auto-update).
- ESA SPICE Cosmographia page: https://www.cosmos.esa.int/web/spice/cosmographia
  (mission plugin precedent).
- NAIF Cosmographia tutorial:
  https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/Tutorials/pdf/individual_docs/47_cosmographia.pdf
