# Phase 0-3 Closure Plan

## Objective

Phases 0 through 3 fully implemented. Phase 0 is already complete. This plan
closes the IMPLEMENTATION_REPORT punch list for Phases 1, 2, and 3 by merging
three design plans (scene + DSK geometry, desktop + Electron, UI + ops) into a
single dependency-ordered implementation. Every task lands against the existing
verifiable command catalog (typecheck, lint, test, build:web, build:desktop,
cap:sync, e2e, size, verify) and respects the binding architecture conventions:
the dependency rule, camera-relative rendering, loud typed errors, and the PAL
kernel boundary.

Three design plans contributed tasks. Where they overlapped (the DSK CSPICE-WASM
rebuild, the DSK scene mesh, and the Electron DSK e2e), the overlapping tasks
have been merged into one canonical task each and renumbered. Tasks are numbered
1 through 33 across seven work batches A to G.

---

## Conventions for this plan

- No em dashes anywhere, per the repository hard rule.
- New @bessel/ui components are presentational: typed props plus callbacks, no
  import of @bessel/spice or @bessel/scene. The viewer (apps/web or apps/desktop)
  owns all engine and scene wiring.
- Every new SPICE/catalog/PAL error stays loud, typed, and located.
- Every new scene node lives in the camera-relative world Group (or, for stars, a
  non-translated or camera-parented group) so the floating-origin invariant holds.
- Do not edit .size-limit.json or lighthouserc.json. If a regenerated wasm or a
  committed fixture threatens a budget, stop and raise it.
- Do not modify docs/adr, CLAUDE.md, AGENTS.md, VISION.md, SPEC.md, or
  IMPLEMENTATION_GUIDE.md during the feature work.

---

## Batch A: SPICE and scene geometry foundations (including the DSK wasm rebuild)

These are the unblockers. The headless scene test harness, the SPICE worker-chain
additions, and the DSK wasm relink gate almost everything else. The two highest
risk items in the whole plan (the wasm rebuild and the DSK fixture) start here so
they de-risk early.

### Task 1: Headless scene unit-test harness for existing geometry (S/M)

- Effort: M
- Files: packages/scene/src/three-scene.test.ts (new),
  packages/scene/src/test-gl.ts (new), packages/scene/package.json (add @types
  only if needed).
- Approach: vitest runs in environment node, so SolarSystemScene cannot build a
  real WebGLRenderer. Refactor the inline geometry builders (FOV cone triangle
  construction, footprint triangle fan, the camera-relative offset math in
  render) into exported pure functions (buildFovConeVertices, buildFootprintVertices,
  cameraRelativeOffset) returning Float32Array/numbers with no GL dependency.
  Provide test-gl.ts as a minimal mock canvas plus WebGL2 context for the few
  cases that need a renderer, but prefer pure functions. Assert FOV cone with N
  rim points yields 3N triangles, footprint fan with N points yields 3N triangle
  vertices, and a solar-system-scale position stays small after cameraRelativeOffset
  (an explicit regression test for the mandatory floating-origin invariant).
- Gate: raises packages/scene test count from zero and becomes the phase baseline.
  pnpm test stays green. Establishes the harness reused by Tasks 2 to 5, 8, 9, 12
  to 17.
- Note: refactors must produce byte-identical vertex arrays; assert before/after.

### Task 2: Add scene visibility seams (setVisible and layer toggles) (M)

- Effort: M
- Files: packages/scene/src/three-scene.ts, packages/scene/src/index.ts,
  packages/scene/src/three-scene.test.ts.
- Approach: the scene currently has NO setVisible (the UI plan's assumption was
  wrong; confirmed in code). Add setVisible(name, visible) toggling the matching
  body/spacecraft mesh.visible (and its trajectory for the spacecraft), plus
  layer toggles setTrajectoryVisible, setFovVisible, setFootprintVisible,
  setAxesVisible, setLabelsVisible, setStarFieldVisible. Trajectory/fov/footprint
  gate existing meshes. Axes/labels/star-field store the flag and expose a getter;
  their full rendering arrives in Batch B (axes) and Batch D (star field), with a
  TODO referencing those tasks so a wired toggle is not mistaken for full support.
  Extract overlays.ts if three-scene.ts exceeds the 250-line cap.
- Gate: closes the "scene has no test files" gap (with Task 1). pnpm test. Unblocks
  the object browser and settings panels (Tasks 21, 22).
- DependsOn: Task 1.

### Task 3: Add ilumin (incidence/emission/phase) through the SPICE worker chain (M)

- Effort: M
- Files: packages/spice/src/index.ts, protocol.ts, client.ts, engine.ts,
  bindings.ts, worker-core.ts, geometry.test.ts.
- Approach: ilumin_c is already exported in the committed wasm (verified), so NO
  rebuild is needed. Add IluminResult {phase, incidence, emission, trgepc, srfvec,
  point} and an ilumin(...) method following the fixed 6-file worker pattern
  (use surfaceMethod not the reserved method key, like sincpt). bindings.ilumin
  mallocs the spoint input and out pointers, calls ilumin_c, checkFailed, reads
  and frees.
- Gate: extend geometry.test.ts with a reference assertion against the committed
  Cassini/Saturn fixture (incidence+emission+phase finite and in [0,pi]; ilumin
  phase matches the observer-sun angle within ~1e-3 rad). Raises spice test count.
  pnpm test, typecheck.

### Task 4: Add DSK CSPICE functions to build-cspice.sh exports and rebuild the wasm (M)

- Effort: M (high risk)
- Files: packages/spice/scripts/build-cspice.sh,
  packages/spice/wasm/cspice.mjs (regenerated), packages/spice/wasm/cspice.wasm
  (regenerated).
- Approach: the EXPORTS array has NO DSK symbols (confirmed; ends near
  spkopn/spksub/spkcls). Add the type-2 reader chain: dasopr_c, dascls_c,
  dskobj_c, dsksrf_c, dskgd_c, dlabfs_c, dlafns_c, dskz02_c, dskv02_c, dskp02_c,
  dskb02_c. For the fixture authoring path (Task 6), also add dskw02_c, dskmi2_c,
  dskrb2_c (writers) only if the fixture must be generated rather than fetched.
  Rerun bash packages/spice/scripts/build-cspice.sh to relink (only the emcc link
  step reruns; the static archive exists). Verify the new symbols appear in
  cspice.mjs and commit the regenerated binaries.
- Gate: pnpm build:web still succeeds with the new wasm; the existing spkpos
  fixture test (within 1e-3 km) still passes, proving no regression. Watch pnpm
  size; do not edit the budget.
- Risk: requires emcc + csh on PATH. If the toolchain is unavailable this task is
  BLOCKED at execution time and Tasks 5, 7, 32, 33 cannot produce a real DSK
  render. Call it out; do not stub.

### Task 5: SPICE bindings to read DSK type-2 vertices and plates (L)

- Effort: L (high risk, critical path)
- Files: packages/spice/src/bindings.ts, index.ts, protocol.ts, worker-core.ts,
  client.ts, engine.ts, packages/spice/src/dsk.test.ts (new).
- Approach: add a high-level readDsk(name): Promise<{vertices:number[];
  plates:number[]}> across the same 6-file worker chain. In bindings: dasopr_c(path)
  to a handle (DSK reading uses dasopr on the staged path, not furnsh, so the PAL
  boundary is honored: the engine hands a path, never raw bytes); dlabfs_c to the
  first DLA descriptor (8 ints) plus found; dskz02_c for nv and np; loop dskv02_c
  to pull all vertices (3 doubles each, km in the body-fixed frame) and dskp02_c
  to pull all plates (3 ints each, convert CSPICE 1-based to 0-based); dascls_c.
  Use a small typed DLA-descriptor helper, not any. Reuse readDouble/readInt and
  checkFailed.
- Gate: dsk.test.ts furnshes the committed fixture (Task 6) and asserts nv>0,
  np>0, plate indices within [0,nv), and a pinned vertex coordinate within
  tolerance (the NAIF-reference pattern). Raises spice test count. pnpm test.
- DependsOn: Task 4, Task 6.

### Task 6: Provide a small DSK shape-model fixture (.bds) (M)

- Effort: M (high risk)
- Files: kernels/fetch.sh, kernels/fixtures/<body>.bds (new, committed) OR
  packages/spice/src/__fixtures__/<body>.bds, packages/spice/scripts/make-fixture-dsk.mjs
  (new, optional generator), .gitignore (only if a force-exception is needed).
- Approach: *.bds is NOT gitignored (only *.bsp), so a DSK fixture commits cleanly.
  Prefer FETCHING an already-small public type-2 DSK and stay on theme with a
  Cassini Saturn-system body: target a Phoebe (NAIF 609) shape DSK; if too large,
  fall back to phobos_3_3.bds-class (Mars moon) or Itokawa, noting the deviation.
  Aim under ~300 KB. If no small public model exists, generate a tiny closed
  type-2 model (e.g. an icosahedron) with dskw02_c/dskmi2_c in make-fixture-dsk.mjs
  (this is why Task 4 may need the writer exports) or an offline NAIF mkdsk step.
  Record the NAIF URL, byte size, and provenance in fetch.sh comments.
- Gate: consumed by Task 5 (dsk.test.ts) and Task 33 (Electron e2e). Fixture must
  be small enough not to threaten the repo or the size budget.
- Risk: resolve the concrete file early; it gates Tasks 5 and 33.

---

## Batch B: scene advanced rendering (Phase 1 geometry, Phase 3 effects)

Built on the Batch A harness and helpers. The Phase 1 items (GLTF, axes,
direction vectors, track camera) and the Phase 3 visual effects (rings,
atmosphere, shadows, star field) live here. The DSK scene mesh that consumes
Task 5 also lands here.

### Task 7: scene.setDskMesh DSK shape-model rendering (M)

- Effort: M
- Files: packages/scene/src/dsk-mesh.ts (new), three-scene.ts, index.ts,
  dsk-mesh.test.ts (new), apps/web/src/viewer.tsx.
- Approach: pure buildDskGeometry(vertices, plates) builds a non-indexed
  BufferGeometry (three vertex positions per plate scaled by SCALE),
  computeVertexNormals for shaded relief, wrapped in MeshStandardMaterial.
  setDskMesh(name, anchorBody, vertices, plates, orientationRowMajor3x3?) anchors
  the mesh at the body in the world Group (floating-origin applies) and rotates it
  into J2000 via a pxform 3x3 using the Task 9 row-major helper. viewer.tsx calls
  spice.readDsk once after furnsh and renders the DSK body in front of the
  procedural Globe.
- Gate: dsk-mesh.test.ts asserts a tetrahedron (4 verts, 4 plates) yields
  4*3*3=36 position floats, computed normals, and SCALE scaling. Headless via the
  Task 1 harness. Real render asserted by the Electron e2e (Task 33).
- DependsOn: Task 5, Task 1.

### Task 8: GLTF spacecraft mesh node with committed .glb and graceful fallback (M)

- Effort: M
- Files: packages/scene/src/spacecraft-model.ts (new), three-scene.ts, index.ts,
  packages/scene/package.json, apps/web/src/assets/cassini.glb (new committed
  binary, under ~30 KB), apps/web/src/viewer.tsx,
  packages/scene/src/spacecraft-model.test.ts (new).
- Approach: three@0.171.0 ships GLTFLoader and @types/three has its d.ts (both
  verified), so NO new dependency. Wrap GLTFLoader.parse(arrayBuffer) to a
  Promise<Group>, normalize the bounding sphere to radiusKm*SCALE. setSpacecraft
  accepts an optional Object3D; use it instead of the SphereGeometry placeholder,
  keep the sphere as a fail-soft fallback with a typed warning (not silent) when
  no glb or parse fails. Generate a tiny low-poly .glb offline, commit it, import
  via Vite ?url like kernels, fetch+parse in viewer.tsx, wire the URL from the
  catalog Mesh entry where present.
- Gate: spacecraft-model.test.ts parses a tiny inline glTF headlessly and asserts
  a Group with a Mesh child and correct normalized radius. Existing chromium
  render test still passes. pnpm typecheck/lint clean, pnpm size respected.
- DependsOn: Task 1.

### Task 9: Reference-frame axis triads (RGB) driven by pxform (S)

- Effort: S
- Files: packages/scene/src/axis-triad.ts (new), three-scene.ts, index.ts,
  axis-triad.test.ts (new), apps/web/src/viewer.tsx.
- Approach: setAxisTriad(name, anchorBody, rotationRowMajor3x3, lengthKm) builds
  three colored line segments (R=+X, G=+Y, B=+Z) anchored at a body and oriented
  from a pxform row-major 3x3. Provide the pure helper rowMajor3x3ToMatrix4(m)
  (transpose because three is column-major), shared with Tasks 7 and 14.
  viewer.tsx throttles pxform('J2000','IAU_SATURN',et) and calls setAxisTriad.
- Gate: axis-triad.test.ts pins the transpose (90deg Z maps +X to +Y) and asserts
  6 vertices with R/G/B per-vertex colors. Headless. Honors the Task 2 axes flag.
- DependsOn: Task 1.

### Task 10: Direction vectors (to Sun, Earth, velocity) as labeled arrows (S)

- Effort: S
- Files: packages/scene/src/direction-vectors.ts (new), three-scene.ts, index.ts,
  direction-vectors.test.ts (new), apps/web/src/viewer.tsx.
- Approach: setDirectionVectors(fromBody, vectors[{label, dirKm, color}]) renders
  each as a thin cylinder/ArrowHelper plus an optional sprite label, grouped and
  anchored at the body. viewer.tsx differences precomputed ephemeris positions for
  Sun/Earth and uses the sampler velocity, so no extra worker round-trip. Pure
  buildArrow(dir, length, color) for testing; guard sprite creation on
  typeof document for the node test.
- Gate: direction-vectors.test.ts asserts normalization and tip = dirhat*length,
  and child count for multiple vectors. Headless.
- DependsOn: Task 1.

### Task 11: Track-along-trajectory camera mode (real behavior) (M)

- Effort: M
- Files: packages/scene/src/three-scene.ts, index.ts, camera-modes.test.ts (new),
  apps/web/src/viewer.tsx, packages/ui/src/ViewControls.tsx (mode toggle).
- Approach: promote CameraMode (orbit | center | track) from a bare type literal
  into scene state with setCameraMode(mode). For track, place the camera behind
  the focus velocity direction looking down-track. Pure
  computeTrackCameraPosition(velocityKm, distance, elevationBias): Vector3 for
  testing. Plumb focus velocity via setFocusVelocity or the sampler (finite-diff
  if the table stores positions only). Guard against velocity-near-zero flips.
- Gate: camera-modes.test.ts asserts dot(camPos, vhat) < 0 and magnitude ~=
  distance, and a mode getter. Extend the chromium e2e to switch to track mode and
  assert mode='track' with a non-empty frame (real Phase 1 gate item).
- DependsOn: Task 1.

### Task 12: Saturn ring rendering from catalog Globe.rings (M)

- Effort: M
- Files: packages/scene/src/rings.ts (new), three-scene.ts, index.ts,
  rings.test.ts (new), apps/web/src/viewer.tsx.
- Approach: setRings(anchorBody, innerRadiusKm, outerRadiusKm, opts?) builds a
  custom annulus with radial UVs (so a banded texture maps along the radius),
  scaled by SCALE, in the body equatorial plane, rotated by the body pxform using
  the Task 9 helper. Translucent DoubleSide material with a procedural banded
  DataTexture. Radii come from the catalog Globe.rings (Cassini Saturn: inner
  74500, outer 140220). viewer.tsx calls setRings.
- Gate: rings.test.ts asserts vertex radii within [inner*SCALE, outer*SCALE] and
  radial UVs spanning 0..1. Headless. Optional chromium frame check.
- DependsOn: Task 9.

### Task 13: Atmosphere shaders (Rayleigh + Mie) for limb glow (L)

- Effort: L
- Files: packages/scene/src/atmosphere.ts (new),
  packages/scene/src/shaders/atmosphere.glsl.ts (new), three-scene.ts, index.ts,
  atmosphere.test.ts (new).
- Approach: setAtmosphere(anchorBody, planetRadiusKm, atmosphereRadiusKm, params)
  renders a back-faced sky shell (BackSide, additive blending) with a simplified
  single-scattering Rayleigh (lambda^-4) plus Mie (Henyey-Greenstein) fragment
  shader, sun direction uniform shared with Task 10. GLSL in its own module so
  three-scene stays small. Gate the effect behind a settings flag.
- Gate: atmosphere.test.ts asserts the JS-side math: rayleighCoefficients give
  higher blue than red (~(700/440)^4) and buildAtmosphereUniforms packs the
  expected names/values. The shader cannot run in node vitest; rendering evidence
  is the e2e non-empty frame, never visual judgement.
- DependsOn: Task 1.

### Task 14: Shadow mapping (sun-cast shadows on bodies and rings) (M)

- Effort: M
- Files: packages/scene/src/three-scene.ts, packages/scene/src/shadows.ts (new),
  index.ts, shadows.test.ts (new).
- Approach: replace the unshadowed sun PointLight with a shadow-casting
  DirectionalLight aimed along the Sun direction, enable
  renderer.shadowMap (PCFSoftShadowMap), set castShadow/receiveShadow on bodies,
  the DSK mesh, and rings. computeShadowFrustum(radiusScene) derives near/far/ortho
  bounds. setShadowSunDirection(dirKm) updates each frame in the translated frame.
  Gate behind a settings flag.
- Gate: shadows.test.ts asserts computeShadowFrustum encloses the body radius with
  margin and near<far. Pure math, headless. Render verified by e2e non-empty frame.
- DependsOn: Task 1.

### Task 15: Star field from a committed star catalog (M)

- Effort: M
- Files: packages/scene/src/star-field.ts (new),
  packages/scene/src/star-catalog.ts (new),
  apps/web/src/assets/bright-stars.json (new, committed, under ~100 KB),
  three-scene.ts, index.ts, star-field.test.ts (new).
- Approach: setStarField(stars[{ra, dec, mag}]) builds a THREE.Points cloud on a
  large fixed-radius celestial sphere parented to the camera (or a non-translated
  group) so stars stay at infinity regardless of focus, sized/colored by
  magnitude. Commit a trimmed Yale Bright Star / Hipparcos subset (~1500 stars
  brighter than mag ~5). Pure radec2vec(raDeg, decDeg) for testing; the parser
  raises located errors on malformed rows. Honors the Task 2 star-field flag.
- Gate: star-field.test.ts asserts radec2vec unit vectors for known stars,
  n*3 position floats, and a typed located parse error on a bad row. Headless.
- DependsOn: Task 1.

---

## Batch C: @bessel/ui panels and keyboard

Presentational components plus the keyboard system. All take typed props and
callbacks; the viewer wires them in Batch D.

### Task 16: ReadoutPanel component (range, phase, incidence, emission) (S)

- Effort: S
- Files: packages/ui/src/ReadoutPanel.tsx, index.ts, ReadoutPanel.test.tsx.
- Approach: presentational ReadoutPanel takes a readonly Readouts prop and renders
  an accessible definition list (role=group, aria-label, per-value data-testid).
  Pure formatting (km thousands grouping, degrees to one decimal, 'n/a' for null,
  no em dashes). The panel does not call SPICE.
- Gate: ReadoutPanel.test.tsx asserts formatting, null placeholder, and accessible
  name. Adds the first @bessel/ui coverage. Use renderToStaticMarkup if
  @testing-library/react is not already a dep.

### Task 17: SettingsPanel (trajectory, FOV, footprint, axes, labels, star field) (S)

- Effort: S
- Files: packages/ui/src/SettingsPanel.tsx, index.ts, SettingsPanel.test.tsx.
- Approach: presentational SettingsPanel takes a VisualizationSettings boolean
  object and onChange(key, value); renders an accessible fieldset with a legend
  and one labelled checkbox per toggle (per-toggle data-testid). The viewer maps
  onChange to the Task 2 scene layer toggles.
- Gate: SettingsPanel.test.tsx asserts accessible labels and correct onChange
  key/value. Protects the axe gate.
- DependsOn: Task 2.

### Task 18: Cosmographia keyboard shortcuts with accessible help (M)

- Effort: M
- Files: packages/ui/src/keymap.ts, KeyboardHelp.tsx, useKeyboardShortcuts.ts,
  index.ts, keymap.test.ts, apps/web/src/viewer.tsx.
- Approach: typed keymap (space play-pause, arrows scrub/rate, c center, ? help).
  useKeyboardShortcuts attaches a window keydown listener, ignores
  input/select/textarea targets, maps keys to a discriminated-union action.
  KeyboardHelp is a focus-trapped role=dialog (aria-modal, Escape to close)
  toggled by ? with a visible help button. The viewer wires handlers to play,
  scrub, rate, centerOn.
- Gate: keymap.test.ts asserts coverage of the required keys with unique bindings,
  and that input-originated keydowns are ignored. The dialog must pass axe modal
  semantics. Optional e2e: Space toggles playback.

### Task 19: ObjectBrowser panel (list, select, visibility toggles) (M)

- Effort: M
- Files: packages/ui/src/ObjectBrowser.tsx, index.ts, ObjectBrowser.test.tsx.
- Approach: presentational ObjectBrowser takes a readonly CatalogEntry list
  ({id, name, kind}), a selection string[], a visibility map, and callbacks
  onToggleSelect/onToggleVisible. Accessible grouped list; each row has a select
  button (aria-pressed reflecting selection membership, supporting the Task 20
  multi-select model) and a labelled visibility checkbox. No SPICE/scene imports.
- Gate: ObjectBrowser.test.tsx asserts rows per entry, aria-pressed from
  selection, correct callback ids, and accessible checkbox names. Protects the
  axe gate.
- DependsOn: Task 2, Task 20.

### Task 20: True multi-object selection (add/toggle) in the viewer (M)

- Effort: M
- Files: apps/web/src/viewer.tsx, packages/ui/src/ViewControls.tsx,
  apps/web/src/selection.ts (new, pure toggle helper).
- Approach: separate camera focus (single, drives centerOn) from the selection
  set (multi). A pure toggleSelection(id) helper (in selection.ts) adds/removes
  preserving order, producing an arbitrary-length readonly string[]. Wire it to
  ObjectBrowser (Task 19) and a ViewControls add-to-selection affordance with
  aria-pressed. The URL codec already supports arbitrary-length selection, so no
  state-package change.
- Gate: extend operations.spec.ts to select two objects and assert data-selection
  holds both ids, persisting across a shared-URL reload. Unit-test selection.ts.
- DependsOn: Task 19.

Note: Tasks 19 and 20 are mutually dependent in the source plans (browser needs
the multi-select model; multi-select is surfaced through the browser). Implement
the pure selection.ts helper and the ObjectBrowser select control together, then
wire them; this resolves the cycle without circular code dependencies.

### Task 21: Timeline annotations data model and scrub-track markers (M)

- Effort: M
- Files: packages/timeline/src/annotations.ts, index.ts, annotations.test.ts,
  packages/ui/src/TimelineControls.tsx, TimelineControls.test.tsx,
  apps/web/src/viewer.tsx.
- Approach: typed TimelineAnnotation {id, et, label, kind?} in @bessel/timeline
  with pure helpers sortByEt and markerFraction(et, min, max) (clamped). The model
  stays in core with no UI import. TimelineControls accepts a readonly annotations
  prop and renders keyboard-reachable, individually labelled markers over the
  range track, onClick(et) to scrub. The viewer supplies fixture annotations.
- Gate: annotations.test.ts asserts sort order and fraction math (endpoints 0/1,
  midpoint 0.5, out-of-range clamps). TimelineControls.test.tsx asserts labelled
  markers and onScrub(et). Adds timeline coverage. Protects the axe gate.

### Task 22: Screen capture (still) and video recording (MediaRecorder) (M)

- Effort: M
- Files: packages/ui/src/capture.ts, CaptureControls.tsx, index.ts,
  capture.test.ts, apps/web/src/viewer.tsx.
- Approach: capture.ts helpers over a provided canvas (preserveDrawingBuffer is
  already true): captureStill(canvas) via toBlob (reject with a typed CaptureError
  on null); createRecorder(canvas, options) over captureStream + MediaRecorder,
  choosing a supported mimeType, exposing start()/stop():Promise<Blob>.
  CaptureControls is an accessible image button plus a Record/Stop aria-pressed
  toggle. Fail loudly with CaptureError when MediaRecorder/captureStream is
  unavailable. Revoke object URLs.
- Gate: capture.test.ts mocks canvas/MediaRecorder: toBlob success resolves,
  toBlob null rejects with CaptureError, recorder assembles a Blob, unsupported
  env throws the typed error. Optional e2e clicks Capture image.

---

## Batch D: Phase 2 ops integration and the integrations-module decision

### Task 23: Wire ObjectBrowser, SettingsPanel, ReadoutPanel, and clock-driven readouts into the web viewer (L)

- Effort: L (main axe-regression surface)
- Files: apps/web/src/viewer.tsx, apps/web/src/readouts.ts (new).
- Approach: readouts.ts computes range (spkpos magnitude) and
  incidence/emission/phase via spice.ilumin with a subpnt-derived surface point,
  reusing the existing ~0.25s throttle. Hold Readouts, VisualizationSettings, and
  a visibility-map state; render the three panels and map callbacks to the Task 2
  scene seams and the Task 20 selection toggle. Build the ObjectBrowser entry list
  from INNER_SYSTEM bodies, the Cassini spacecraft, and the loaded instrument id.
  Extract readouts.ts and a panels-layout subcomponent so viewer.tsx (already
  ~377 lines) stays within the structure guidelines.
- Gate: extend operations.spec.ts to assert a finite range readout once Ready, a
  SettingsPanel checkbox flipping a scene data-* attribute, and an ObjectBrowser
  toggle hiding a body. The axe scan stays at zero serious/critical.
- DependsOn: Tasks 3, 16, 17, 19, 20, 21, 22, 2.

### Task 24: Resolve the MMGIS/CZML integrations-module deviation (S)

- Effort: S
- Files: packages/state/src/index.ts, mmgis.ts, czml.ts.
- Approach: KEEP mmgis.ts and czml.ts in @bessel/state (do NOT extract a new
  @bessel/integrations package). Both are pure functions over @bessel/state
  ViewModel/trajectory types, already covered by state.test.ts; extraction is
  naming churn with verify-gate and dependency-rule risk for zero behavioral gain.
  Group them under a named integrations re-export in index.ts for discoverability
  and add a one-line comment noting the deviation is intentional. Do not edit
  docs/ADRs; if a binding record is wanted, raise an ADR checkpoint.
- Gate: existing state.test.ts assertions stay green; pnpm verify stays green; the
  re-export must not duplicate exports or break tree-shaking/size.

---

## Batch E: desktop typed IPC, Python bridge, and dialogs

The Phase 1 typed-IPC deviation and the Phase 3 native dialogs plus Python bridge.
The IPC contract and the renderer-side consumers live in pal-electron (no electron
import); only apps/desktop imports electron.

### Task 25: Typed desktop IPC channel constants and payload contracts in pal-electron (S)

- Effort: S
- Files: packages/pal-electron/src/ipc-contract.ts (new), index.ts (export),
  ipc-contract.test.ts (new).
- Approach: a single source of truth for the bridge surface consumed by both the
  preload/main (apps/desktop) and the renderer-side IpcKernelSource. Export the
  BESSEL_IPC channel-name const object, a BesselBridge interface (platform,
  versions, async listKernels/resolveKernel/readKernel/readKernelRange, fs methods,
  openDialog, saveDialog, runPython, pythonAvailable), and the request/result types
  (PythonRunRequest/Result, DialogOpen/SaveOptions). Reuse KernelHandle from
  @bessel/pal. Must NOT import electron, preserving the dependency rule. Add a
  scoped Window augmentation for window.bessel.
- Gate: ipc-contract.test.ts asserts channel-name uniqueness/stability and a
  satisfies-based compile guard. pnpm typecheck/test green.

### Task 26: Implement the Electron preload contextBridge over the typed contract (S)

- Effort: S
- Files: apps/desktop/electron/preload.ts.
- Approach: replace the {platform, versions} stub with
  contextBridge.exposeInMainWorld('bessel', api) where api implements BesselBridge
  by delegating each method to ipcRenderer.invoke(BESSEL_IPC.<channel>, ...args),
  importing names/types from the Task 25 contract. contextIsolation stays true. A
  thin typed pass-through, no business logic; binary reads return Uint8Array.
- Gate: covered indirectly by Task 33. pnpm build:desktop still produces
  out/preload/preload.mjs. Ensure the workspace contract import is bundled (not
  externalized).
- DependsOn: Task 25.

### Task 27: ipcMain handlers in Electron main backed by NodeKernelSource (M)

- Effort: M
- Files: apps/desktop/electron/main.ts, ipc-handlers.ts (new),
  kernel-root.ts (new).
- Approach: registerIpcHandlers(app) called inside app.whenReady before
  createWindow, using ipcMain.handle per channel. Kernel channels delegate to a
  single NodeKernelSource rooted at a resolved kernel directory (dev fixture root
  with a BESSEL_KERNEL_ROOT override, prod userData/kernels; kernel-root.ts
  centralizes resolution). Filesystem channels delegate to node:fs/promises with
  the located PalError translation pattern, serializing PalError as
  {message, code, location} for typed rethrow in the renderer. main.ts only wires
  registration; ipc-handlers.ts under 200 lines.
- Gate: exercised by Task 33 e2e; optional unit for kernel-root.ts. pnpm
  build:desktop stays green. main.ts must not import scene/UI.
- DependsOn: Task 25.

### Task 28: IpcKernelSource and IpcFileSystem in pal-electron consuming window.bessel (M)

- Effort: M
- Files: packages/pal-electron/src/ipc-kernel-source.ts (new),
  ipc-filesystem.ts (new), index.ts (export + createElectronPlatform),
  ipc-kernel-source.test.ts (new).
- Approach: IpcKernelSource implements KernelSource by calling the injected bridge
  (default globalThis.window?.bessel), throwing a located PalError('not-supported')
  if absent, and rethrowing a real PalError from the serialized {code, location}
  shape to preserve loud typed errors. IpcFileSystem likewise. createElectronPlatform(bridge)
  aggregates IpcKernelSource, IpcFileSystem, a renderer Storage, an Electron Share
  (dialog save via bridge), and electronCapabilities. NodeKernelSource stays for
  the main-process/contract-test path.
- Gate: ipc-kernel-source.test.ts runs the SHARED kernel-source contract suite
  against an IpcKernelSource backed by a fake in-memory bridge (with readRange),
  asserting located PalError reconstruction on the missing-kernel case. Raises
  pal-electron test count. pnpm test.
- DependsOn: Task 25.

### Task 29: Mount the shared scene, SPICE worker, and pal-electron in the desktop renderer (L)

- Effort: L
- Files: apps/desktop/src/main.tsx, desktop-viewer.tsx (new), spice.ts (new),
  spice.worker.ts (new), apps/desktop/package.json,
  apps/desktop/electron.vite.config.ts.
- Approach: replace the placeholder App with a DesktopViewer mirroring
  apps/web/src/viewer.tsx but injecting createElectronPlatform(window.bessel) and
  resolving kernels via the native open dialog (Task 30) or a fixture meta-kernel
  for the e2e. spice.worker.ts/spice.ts copy the web worker pattern. In the
  renderer config add worker:{format:'es'} and route the emitted cspice.wasm URL
  through SpiceEngineOptions.locateFile as the web does. Expose the
  data-testid='viewport' and data-ready attributes the e2e frame-stats helper
  expects. @bessel/scene is reused unchanged, preserving camera-relative rendering.
- Gate: pnpm build:desktop succeeds and bundles the worker plus wasm into
  out/renderer; verify file:// wasm load works (or fetch via the bridge). pnpm
  typecheck. Render asserted by Task 33.
- DependsOn: Task 28.

### Task 30: pal-electron native open/save dialogs backed by real ipcMain + dialog code (M)

- Effort: M
- Files: apps/desktop/electron/ipc-handlers.ts (add dialog handlers),
  packages/pal-electron/src/dialogs.ts (new), index.ts (export
  openKernelDialog/saveProductDialog; back fileDialogs honestly).
- Approach: main adds ipcMain.handle for dialogOpen (dialog.showOpenDialog,
  filtered) returning filePaths or null on cancel, and dialogSave
  (dialog.showSaveDialog). dialogs.ts exposes openKernelDialog (pre-filtered for
  .tm/.bsp/.bds) and saveProductDialog over the bridge. Wire the desktop viewer's
  Open meta-kernel control to openKernelDialog then resolveMetaKernel.
  electronCapabilities.fileDialogs becomes honest because code now backs it.
- Gate: dialogs.test.ts asserts the wrapper forwards correct filters and maps
  cancel to null via a fake bridge (no native-modal e2e, which would be flaky).
  pnpm test, count rises.
- DependsOn: Task 26, Task 27, Task 29.

### Task 31: Python scripting bridge for batch geometry products, capability gated on python presence (L)

- Effort: L
- Files: apps/desktop/electron/python-bridge.ts (new), ipc-handlers.ts (add
  pyRun/pyAvailable), apps/desktop/resources/batch_geometry.py (new),
  packages/pal-electron/src/python.ts (new), index.ts (runtime-detect
  pythonBridge), python.test.ts (new).
- Approach: main-side detectPython() spawns python3/python --version (cached);
  runPython spawns the bundled batch_geometry.py with a JSON request on stdin and
  parses JSON product rows, failing loudly with a typed error if python/spiceypy
  is missing. batch_geometry.py uses spiceypy to compute spkpos over a time grid.
  Renderer python.ts wraps the bridge. Keep the static
  electronCapabilities.pythonBridge=true so capabilities.test.ts stays green, but
  createElectronPlatform additionally sets capabilities.pythonBridge = await
  bridge.pythonAvailable() so the UI degrades when python is absent. child_process
  only in main; the render path never depends on python.
- Gate: capabilities.test.ts stays green (static flag matrix unchanged). python.test.ts
  unit-tests the wrapper against a fake bridge (pass-through + typed error mapping);
  do not require python in CI. Optional main integration test skipped when python
  is absent. pnpm test.
- DependsOn: Task 26, Task 27.

---

## Batch F: Electron e2e and the DSK render gate

### Task 32: DSK rendering wired end to end in the desktop renderer (M)

- Effort: M
- Files: apps/desktop/src/desktop-viewer.tsx, packages/scene/src/index.ts (ensure
  setDskMesh is exported).
- Approach: the desktop viewer resolves a fixture meta-kernel (.tm) through
  pal-electron meta-kernel resolution (the one Phase 3 feature already real),
  furnshes the DSK fixture (Task 6), reads it via spice.readDsk (Task 5), calls
  scene.setDskMesh (Task 7), centers on the body, and sets data-ready plus a
  data-dsk attribute once a non-empty frame is drawn. This reuses the Task 7 scene
  DSK mesh (the scene and desktop plans converged here) so there is one DSK render
  path, not two.
- Gate: prepares the renderer for the Task 33 e2e. pnpm build:desktop, typecheck.
- DependsOn: Task 5, Task 6, Task 7, Task 29.

### Task 33: Electron Playwright project and e2e: load a meta-kernel and render a DSK body (L)

- Effort: L (highest-risk gate in the plan)
- Files: e2e/playwright.config.ts, e2e/tests/electron-dsk.spec.ts (new),
  e2e/tests/frame-stats.ts (new, factored out of poc-cassini.spec.ts),
  e2e/package.json, .github/workflows/ci.yml, package.json (build ordering).
- Approach: add a second Playwright project named electron (testMatch
  electron-*.spec.ts, no webServer so it does not start the web preview) using
  @playwright/test _electron.launch pointing at apps/desktop/out/main/main.js with
  BESSEL_KERNEL_ROOT set to the fixture meta-kernel tree. The test loads the
  meta-kernel, renders the DSK body (Task 32), waits for data-ready='true', and
  asserts a non-empty WebGL frame via the shared frameStats helper plus the
  data-dsk attribute, never visual judgement. A global setup asserts
  out/main/main.js exists (fail loudly if build:desktop was skipped). Update CI to
  build:desktop before e2e and prefix the electron project with xvfb-run -a on
  ubuntu-latest. This is the only HARD Phase 3 completion condition that currently
  cannot pass.
- Gate: this IS the required Phase 3 e2e gate. pnpm e2e includes and passes it;
  pnpm build:desktop produces the runnable build it launches. Adds the electron
  project so CI runs it. Do not skip or weaken the test to pass.
- DependsOn: Task 5, Task 6, Task 7, Task 30, Task 31, Task 32.

---

## Batch G: test backfill (pal coverage gaps)

These are test-only tasks with no production dependencies; sequence them early in
parallel, but they are grouped here because they backfill coverage rather than add
features. None changes production behavior.

### Task 34: OPFS kernel cache unit test (S)

- Effort: S
- Files: packages/pal-web/src/opfs-cache.test.ts (new).
- Approach: test OpfsKernelCache and openKernelCache against an in-memory fake of
  the OPFS handle API (FakeDirectoryHandle/FileHandle/Writable backed by a Map).
  Assert put/get byte round-trip, get-on-missing returns null, and safe() id
  sanitization collisions. Add an HttpKernelSource cache-hit-skips-fetch test with
  a stub fetch spy and a pre-populated fake cache (fetch NOT called on hit; called
  once and written back on miss). Confirm the read() cache-injection seam exists
  before writing; do not change production behavior to make it testable.
- Gate: this IS the test; raises pal-web count above the Phase 2 baseline. pnpm
  test with no real OPFS.

### Task 35: pal-capacitor importKernelZip unit test (S)

- Effort: S
- Files: packages/pal-capacitor/src/kernel-source.test.ts (new),
  packages/pal-capacitor/vitest.config.ts (only if module mocking needs it).
- Approach: vi.mock('@capacitor/filesystem') capturing writeFile into a Map; build
  a real zip with fflate zipSync including a nested path and a directory entry,
  pass to importKernelZip, and assert leaf-name flattening, directory-entry skip,
  byte-equal round-trip through base64, and deterministic overwrite. Include an
  entry larger than 32KB to exercise the base64 chunk boundary. Confirm the
  workspace Vitest glob discovers pal-capacitor tests before adding config.
- Gate: this IS the test; first pal-capacitor coverage. pnpm test, fully mocked.

---

## Gates impact

Mapping tasks to the Phase completion conditions and any newly required commands.

### Phase 1 completion conditions

- GLTF spacecraft nodes: Task 8.
- Reference-frame axis triads: Task 9.
- Direction vectors and labels: Task 10.
- Track-along-trajectory camera mode: Task 11 (adds a chromium e2e assertion).
- Object browser, settings panel, keyboard shortcuts: Tasks 19, 17, 18, wired by
  Task 23; visibility seams from Task 2.
- Desktop typed IPC (preload deviation): Tasks 25 to 29.
- packages/scene test files (was zero): Tasks 1, 2, and every Batch B unit test.
- Commands: pnpm typecheck, lint, test, build:web, build:desktop, e2e (chromium),
  size, verify all stay green.

### Phase 2 completion conditions

- Geometric readouts via @bessel/spice: Task 3 (ilumin) plus Task 16/Task 23.
- Multi-object selection: Task 20 (and Task 19).
- Timeline annotations with event markers: Task 21.
- Screen capture and video recording: Task 22.
- Integrations-module deviation resolved (documented decision): Task 24.
- Test-coverage gaps (OPFS, pal-capacitor): Tasks 34, 35.
- Commands: pnpm test (raised counts), e2e operations.spec (readouts, multi-select,
  toggles, axe scan zero serious/critical), verify.

### Phase 3 completion conditions

- DSK shape-model rendering: Tasks 4, 5, 6, 7, 32 (one canonical DSK path).
- Ring rendering: Task 12.
- Atmosphere shaders: Task 13.
- Shadow mapping: Task 14.
- Star field: Task 15.
- Native open/save dialogs (capability honestly backed): Task 30.
- Python scripting bridge (capability gated on python presence): Task 31.
- HARD condition, Playwright Electron test that loads a meta-kernel and renders a
  DSK body: Task 33.
- Commands: pnpm build:desktop (now bundles worker + wasm), pnpm e2e MUST include
  the new electron Playwright project.

### Newly required commands and CI changes

- A new Playwright electron project (Task 33) added to e2e/playwright.config.ts;
  pnpm e2e now runs it. CI (.github/workflows/ci.yml) must run build:desktop
  before e2e and wrap the electron project in xvfb-run -a on Linux.
- The regenerated cspice.mjs and cspice.wasm (Task 4) are committed binaries; pnpm
  size must still pass without editing the budget.
- New committed binaries (cassini.glb, the .bds DSK fixture, bright-stars.json)
  must each stay within the size budget.

---

## Risks and sequencing

The two highest-risk items are the DSK CSPICE-WASM rebuild and the Electron e2e.
Both sit on the critical path, so they start as early as possible to de-risk.

1. DSK wasm rebuild (Task 4): requires emcc + csh on PATH. If the toolchain is
   unavailable in the run environment, Tasks 5, 7, 32, and 33 cannot produce a
   real DSK render. This must be attempted first and, if blocked, flagged loudly
   rather than stubbed. The regenerated binaries must be committed.
2. DSK fixture (Task 6): the real risk is finding a small, public, type-2 DSK.
   Preferred concrete target is a Cassini Phoebe (NAIF 609) shape DSK to stay on
   theme, with a phobos_3_3.bds-class Mars-moon model as the small fallback, or a
   generated icosahedron (which makes Task 4's writer exports necessary). Resolve
   the concrete file early because it gates Tasks 5 and 33.
3. DSK marshaling (Task 5, L): the DLA descriptor layout and the 1-based to
   0-based plate-index conversion are the main hazards; a typed helper, not any.
4. Electron e2e (Task 33, L): the only HARD Phase 3 condition that currently
   cannot pass. It integrates Tasks 5, 6, 7, 30, 31, 32 and depends on file://
   wasm/worker bundling (Task 29) plus a display server (xvfb) in CI. Sequence it
   last within its dependency chain but begin its prerequisites early.
5. Desktop renderer wasm/worker under file:// (Task 29, L): if file:// wasm load
   is unreliable, fall back to fetching via the bridge or ensure out/renderer
   ships the wasm; do not regress camera-relative rendering.
6. Accessibility regression (Task 23 and every new panel): the axe scan in
   operations.spec checks zero serious/critical. Every control needs a programmatic
   name; the keyboard help dialog needs correct modal/focus semantics; timeline
   markers need per-marker labels. Task 23 is the largest axe surface.
7. Headless GL limits: atmosphere (Task 13) and shadows (Task 14) cannot be fully
   unit-tested in node vitest; their CI evidence is the JS-side math tests plus the
   e2e non-empty-frame assertion, never visual judgement.

Suggested overall order: Batch A first (Task 1 unblocks all scene tests; Tasks 4
and 6 in parallel, then Task 5). The Batch G test-only tasks (34, 35) and the
foundations Task 3, plus the independent presentational panels, can proceed in
parallel with the DSK critical path. Batch B follows the harness; Task 7 follows
Task 5. Batch C panels feed Batch D's Task 23. Batch E proceeds in parallel from
Task 25; Task 29 needs Task 28. Batch F closes last (Task 32 then Task 33).

---

## Ordered commit checklist

One commit per coherent batch, each landing with green gates (pnpm verify, plus
the relevant build:desktop or e2e where the batch touches them).

1. feat(spice,scene): DSK wasm exports + readDsk bindings + fixture + headless
   scene harness + visibility seams + ilumin (Batch A: Tasks 1 to 6). Gate:
   typecheck, lint, test, build:web, size.
2. feat(scene): DSK mesh, GLTF spacecraft, axis triads, direction vectors, track
   camera, rings, atmosphere, shadows, star field (Batch B: Tasks 7 to 15). Gate:
   typecheck, lint, test, build:web, size, chromium e2e.
3. feat(ui): ReadoutPanel, SettingsPanel, keyboard shortcuts + help, ObjectBrowser,
   multi-select model, timeline annotations, capture/recording (Batch C: Tasks 16
   to 22). Gate: typecheck, lint, test.
4. feat(web): wire panels, clock-driven readouts, and multi-select into the viewer;
   keep MMGIS/CZML in @bessel/state with a documented re-export (Batch D: Tasks 23,
   24). Gate: verify, operations e2e with axe scan.
5. feat(pal-electron,desktop): typed IPC contract, preload bridge, ipcMain
   handlers, IpcKernelSource/FileSystem, renderer mount, native dialogs, Python
   bridge (Batch E: Tasks 25 to 31). Gate: typecheck, lint, test, build:desktop.
6. feat(desktop,e2e): DSK rendering in the desktop renderer + the Electron
   Playwright project asserting a non-empty DSK render (Batch F: Tasks 32, 33).
   Gate: build:desktop, e2e including the electron project (xvfb on CI).
7. test(pal-web,pal-capacitor): OPFS cache and importKernelZip unit tests (Batch G:
   Tasks 34, 35). Gate: test. (May be committed earlier since it is independent;
   listed last as a coherent test-backfill batch.)
