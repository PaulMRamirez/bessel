# Getting Started: Load, Explore, Analyze, Export

This is the task-oriented on-ramp: from a fresh checkout to a real analysis
result and an exported file. It assumes only Node.js 22 LTS and pnpm 9+. For the
toolchain-heavy steps (rebuilding CSPICE-WASM, regenerating kernel fixtures) see
docs/build-from-source.md. For the full reference on each analysis tool see
docs/analysis-tools.md.

## 1. Install and run

```
pnpm install
pnpm --filter @bessel/web dev
```

Open the printed local URL. The app boots into a neutral inner-solar-system
scene: the Sun and planets from the bundled demo ephemeris, no mission baked in.
The boot is offline-capable; CSPICE runs as WebAssembly in a Web Worker, so
kernel loading and geometry never block the UI.

## 2. The layout

The shell has four regions:

- Left: the Objects panel, a filter box, the view-preset and camera-mode
  controls, and the object browser (select, toggle visibility, center).
- Center: the 3D viewport, a status line, instrument/track/share controls, a
  Layers popover and a `?` help button (top-right), and, when something is
  selected, an inspector card (identity, readouts, measurement).
- Top bar: the Mission, Capture, Views, Propagate, and Report menus, the Analysis
  menu (which appears once a spacecraft mission is loaded), and the theme toggle.
- Bottom: the timeline (play/pause, rate, scrub, event annotations).

Press `?` (or the help button) for the keyboard-shortcut overlay.

## 3. Load a mission

Open the Mission menu. There are three ways in:

- One-click sample: "Load Cassini at Saturn" loads
  `apps/web/public/samples/cassini-saturn.json`, a native catalog that drives the
  full Cassini-at-Saturn scene (Saturn globe with rings and an atmosphere, the
  Cassini trajectory and glTF model, and the ISS wide-angle field-of-view cone and
  footprint) entirely from catalog data.
- Load catalog: pick a Cosmographia or native Bessel catalog JSON file.
- Drag and drop a catalog JSON onto the window.

A loaded native catalog rebuilds the rendered scene generically. Missing kernels,
unresolved bodies, and bad catalog references fail loudly with a located error;
the kernels a mission needs must be furnished (the bundled demo kernels cover the
inner system, Saturn, and Cassini). See docs/catalog-schema.md to author your own.

## 4. Explore

- Navigate: drag to orbit, right-drag or shift-drag to pan, wheel to dolly toward
  the cursor, pinch on touch. In free-fly mode use `W A S D` to translate and
  `Q E` to move up/down; `,` and `.` roll; `-` and `=` change the field of view.
- Camera modes (left panel): orbit, sync-orbit (locks to a body-fixed frame), and
  free-fly. Track follows the spacecraft. View presets: top-down, from the Sun,
  along the velocity vector.
- Select: click a body or spacecraft to select and center it; the inspector card
  shows its identity and readouts (range, altitude, phase/incidence/emission).
- Drive time: play/pause, change the rate, and scrub on the timeline; event
  annotations (e.g. Saturn orbit insertion) are clickable.
- Layers: the top-right Layers popover toggles trajectories, orbits, labels, the
  field-of-view cone, the footprint, axes, the star field, the atmosphere, and
  shadows.
- Measure: select two objects to read their distance, relative speed, and angular
  separation in the measure panel.

## 5. Run your first analysis

The Propagate menu works without a loaded mission, so start there:

1. Open Propagate and click "Propagate sample TLE (SGP4)". Bessel parses the
   bundled two-line element set, runs SGP4, publishes the arc as an in-memory SPK,
   and reads it back as an altitude time series and a ground track, with the orbit
   period.
2. Click "Ground-station access" to find the visible passes over a representative
   station (an elevation mask intersected with a range gate), with a pass count
   and coverage figure of merit. Export them with the CSV button.
3. Click "Propagate numerically (HPOP)" to integrate the same initial state with
   the native Cowell propagator (adaptive DOPRI5, point-mass + J2) and compare its
   altitude against SGP4.

With a spacecraft mission loaded (step 3), the Analysis menu appears: eclipse
intervals, range, Sun access with a coverage figure of merit, downlink Eb/N0,
conjunction, constellation design, attitude slew, Lambert transfer, ground track,
and CCSDS OEM export. Each result has an Export CSV button.

The Report menu is the parameterized path: pick a provider (range, range rate,
speed, position, velocity, sub point), an observer/target pair, a frame, and a
time grid, then run one job to get a unit-tagged report table and a CSV.

## 6. Save and share

- Views menu: save the current camera/epoch/selection as a bookmark.
- Share view: writes the full view state into the URL fragment and copies the
  link; anyone who opens it sees the exact moment and viewpoint (the same `v=1`
  contract MMGIS links to; see docs/integrations.md).
- Capture menu: save a PNG still or record a WebM of the viewport.

## 7. Next steps

- docs/analysis-tools.md: what each tool computes, its inputs, validation, and
  limits (and the honest-limits note on the fixed-parameter demo buttons).
- docs/architecture.md: how the 24-package monorepo fits together.
- docs/catalog-schema.md: authoring your own missions.
- docs/build-from-source.md: building all three targets and relinking CSPICE-WASM.
