# Bessel

An open-source, SPICE-aware 3D mission visualization application, delivered from a
single codebase as a Progressive Web App, as native mobile apps (via Capacitor),
and as a desktop app (via Electron). It reads Cosmographia-compatible catalogs,
drives geometry from CSPICE compiled to WebAssembly, and renders with Three.js.

Beyond visualization, Bessel ships a validated mission-analysis engine layer
(orbit propagation, access, lighting, communications, conjunction, attitude,
coverage, maneuver design, and CCSDS interop) surfaced in three interactive
workbenches. It also runs headless: special-perturbations propagation (NxN gravity,
drag, SRP) with dense output, event detection, and the State Transition Matrix; an
Astrogator-class Mission Control Sequence with a differential corrector, nested
targeting, finite burns, and a fuel-optimal gradient optimizer; orbit determination
(batch least-squares and an EKF, with light-time and consider parameters); the
EOP-aware TEME to J2000 transform; and a deterministic batch runner
(`@bessel/sdk` and the `bessel` CLI) that executes a JSON job with no UI. Every analysis quantity is asserted against an
independent numeric reference; see docs/analysis-tools.md and
docs/STK_PARITY_SPEC.md.

License: Apache-2.0 (LICENSE at the root).

Program objective: a fully featured, production quality, efficient application.
The objective is enforced by verifiable gates (ADR-0009).

## What this repository contains

A pnpm workspace monorepo of 27 typed core packages (`packages/`), a platform
abstraction layer with web, Electron, Capacitor, and Node implementations, and the
app shells (`apps/web`, `apps/desktop`, `apps/mobile`, and the `apps/cli` headless
batch runner). The web app boots a neutral inner-solar-system scene and renders any
loaded mission through a generic, catalog-driven builder.

The core packages split into two families (see docs/architecture.md for the full
map):

- Visualization and platform: `spice` (CSPICE-WASM in a Web Worker), `catalog`,
  `scene`, `timeline`, `state`, `color`, `ui`, and the `pal` interface with its
  `pal-web` / `pal-electron` / `pal-capacitor` implementations.
- Analysis engines: `propagator` (SGP4, two-body, J2/J4, Cowell HPOP with NxN
  gravity, drag, and SRP, dense output + events + STM, an Astrogator-class MCS with a
  differential corrector, nested targeting and finite burns, and TEME to J2000),
  `od` (orbit determination: batch least-squares and an EKF), `access`, `events`
  (eclipse), `rf` (link budgets), `coverage`, `conjunction`, `attitude`, `sensors`,
  `mission` (Lambert, maneuvers), `map-projection`, `interop` (CCSDS OEM/OMM/CDM),
  `analysis`, and `terrain`.
- Automation: `sdk` (a JSON batch-job IR, a `defineJob` builder, and a headless
  `runJob` runner) with `pal-node` (Node kernel/file IO) driving the `bessel` CLI.

## Running it

```
pnpm install
pnpm --filter @bessel/web dev      # web app (Vite dev server)
pnpm build:web                     # production PWA build
pnpm build:desktop                 # Electron build
pnpm cap:sync                      # sync the iOS shell against the web build
pnpm build:cli                     # bundle the bessel headless batch runner to a Node binary
```

Run a headless batch job once the CLI is built:

```
node apps/cli/dist/main.js run mission.job.json --out ./artifacts
```

`pnpm verify` runs the gate (typecheck, lint, test, build:web, size). The full
verifiable command catalog is in CLAUDE.md and SPEC.md Section 8; CI runs the
same vocabulary (`.github/workflows/ci.yml`).

## Sample missions

The web app boots into a neutral inner-solar-system scene; no mission is baked
in. Missions are data: load a Cosmographia or native Bessel catalog through the
Mission panel (the "Load catalog" button, or drag and drop a JSON file), and the
generic builder renders it (bodies, spacecraft, trajectory, the seven geometry
types, rings, atmosphere, axis triads, direction vectors, the instrument field
of view and footprint, and a glTF model).

A worked example ships as a one-click sample: "Load Cassini at Saturn" in the
Mission panel loads `apps/web/public/samples/cassini-saturn.json`, a native
catalog that drives the Cassini-at-Saturn scene (Saturn globe with image texture,
rings, and an atmosphere; the Cassini trajectory, glTF model, and a uniform
spin; and the ISS wide-angle FOV cone and footprint) entirely from catalog data.
The Operations panel also lists this mission from the plugin registry, runs a
scripted guided tour, and shows a predicted-versus-actual telemetry residual.
Copy and edit the sample file as a starting point for your own mission; the
kernels its bodies need must be furnished (the bundled demo kernels cover the
inner system, Saturn, and Cassini).

## Mission analysis workbenches

Menus in the app shell run the analysis engines and render the results as
Gantt timelines, time-series charts, ground-track overlays, report tables, and
file exports. Full reference: docs/analysis-tools.md.

- Analysis (appears once a spacecraft mission is loaded): eclipse/umbra
  intervals, range time series, Sun line-of-sight access with a coverage figure
  of merit, downlink Eb/N0 link budget, conjunction time-of-closest-approach and
  2D collision probability, Walker-Delta constellation design, eigen-axis
  attitude slew, Lambert transfer delta-v, ground track, and CCSDS OEM export.
- Propagate (always available): propagate a bundled sample TLE with SGP4 into an
  in-memory SPK and read back altitude, ground track, and period; find
  ground-station access; and propagate the same state numerically with the native
  Cowell HPOP, choosing the force model (point-mass / J2 / NxN gravity / drag / SRP).
- Mission Design (always available): assemble a Mission Control Sequence (initial
  state, propagate, impulsive maneuver, target), run the differential corrector, and
  render the resulting trajectory plus the corrector convergence report.
- Orbit Determination (always available): run the batch least-squares estimator on
  synthetic range/range-rate/angle tracking and read back the estimated state, the
  residual RMS, and the covariance.
- Report: pick a data provider (range, range rate, speed, position, velocity, sub
  point) for an observer/target pair over a time grid, run one cancellable
  evalSeries job, read the unit-tagged report table, and export CSV.

The Analysis and Propagate buttons use fixed demonstration parameters (one-day
spans, a representative DSN/Goldstone station, the bundled sample TLE, and an
illustrative conjunction covariance) to exercise each engine end to end; the
Report workbench is the parameterized path. Every engine is validated against an
independent reference (docs/STK_PARITY_SPEC.md, REFERENCES.md).

The shell also carries Cosmographia-style interaction menus: a Script console (run a
BesselScript program against the live viewer), a Plugins loader (load a registered
mission add-on, furnishing its kernels in dependency order), and a Telemetry overlay
(predicted-versus-actual residuals in OpenMCT/Yamcs idioms).

## Where to start

1. docs/getting-started.md: load a mission, explore, run an analysis, export.
2. docs/analysis-tools.md: one entry per workbench tool (inputs, what it computes,
   validation, limits).
3. docs/architecture.md: the layering and the 24-package map.
4. SPEC.md: the visualizer specification and the verifiable command catalog;
   docs/STK_PARITY_SPEC.md: the analysis-engine specification and status.
5. docs/PARITY_MATRIX.md: the feature-by-feature parity check against
   Cosmographia, with the current implemented status.
6. docs/catalog-schema.md: the native catalog schema for authoring missions.
7. docs/build-from-source.md: building, the CSPICE-WASM relink, and the gates.
8. docs/adr/: the binding architecture decisions. REFERENCES.md: curated sources.

A by-audience index of all documentation is in docs/README.md.

## Project configuration

- CLAUDE.md: canonical agent context: tech stack, the verifiable command
  catalog, the dependency rule, and the working conventions.
- docs/adr/: the binding architecture decisions.
- .claudeignore: secrets and bulk kernel data the agent must not touch.
- .github/workflows/ci.yml: CI running the same gate vocabulary as `pnpm verify`.
- .size-limit.json, lighthouserc.json: the efficiency budgets (hard gates).
- CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md: governance.

## House rules

Do not use em dashes anywhere in this repository (code, comments, docs, commit
messages, UI copy). Use commas, colons, parentheses, or semicolons.
