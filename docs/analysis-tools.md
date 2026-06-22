# Analysis Tools Reference

One entry per workbench tool: its inputs, what it computes, the engine behind it,
its validation, and its limits. The tools live in three menus in the app shell.
For a guided first run see docs/getting-started.md; for the validation provenance
see REFERENCES.md and docs/STK_PARITY_SPEC.md.

## How to read this reference

- Availability: the Analysis menu appears only once a spacecraft mission is
  loaded; Propagate and Report are always available.
- Every result can be exported. Time series and intervals export to CSV; the
  trajectory exports to a CCSDS OEM file; the Report workbench is the
  parameterized path.

### Honest limits (read this first)

- The Analysis and Propagate buttons use fixed demonstration parameters chosen to
  exercise each engine end to end: one-day spans, a representative DSN 34 m
  X-band station and a Goldstone-class ground station, the bundled sample TLE,
  and an illustrative conjunction covariance. They are not configurable from the
  UI yet. The Report workbench is the parameterized path (any provider, observer,
  target, frame, and grid).
- SGP4 produces TEME coordinates; Bessel publishes them as J2000, an
  arcminute-scale approximation near the element epoch. An EOP-aware TEME to
  J2000 transform is deferred (docs/STK_PARITY_SPEC.md).
- The numerical propagator ships point-mass, zonal and full NxN tesseral spherical
  harmonics (`packages/propagator/src/force/spherical-harmonics.ts`), a third-body
  term, atmospheric drag (`force/drag.ts`, with Harris-Priester and Jacchia-1971
  density models), and solar radiation pressure (`force/srp.ts`), all selectable in
  the force model.
- Each engine is validated against an independent reference (below). The fixed
  demo parameters are for demonstration; treat absolute numbers accordingly.

---

## Analysis menu

### Eclipse (umbra intervals)
- Inputs: the loaded spacecraft and its central body; a one-day span at a 120 s
  search step.
- Computes: the intervals during which the spacecraft is in the central body's
  umbra (total shadow), rendered as a Gantt timeline.
- Engine: `@bessel/events` (CSPICE `gfoclt` occultation finder + `occult`).
- Validation: `gfoclt` intervals cross-checked against the per-epoch `occult`
  code; tested on the Cassini-at-Saturn shadow.
- Limits: umbra only in the UI (penumbra/annular/sunlit are available in the
  engine); fixed one-day span.

### Range (time series)
- Inputs: spacecraft to central body, one-day span at a 360 s step.
- Computes: the scalar range (km) over time, plotted as a line chart.
- Engine: the F3 `evalSeries` `range` provider over the SPICE worker.
- Validation: the interpreter reproduces per-epoch `spkpos` to sub-millimeter.

### Sun access + figure of merit
- Inputs: spacecraft to the Sun, occulted by the central body; one-day span,
  120 s step.
- Computes: the line-of-sight access window (a Gantt), reduced to a figure of
  merit (percent coverage, access count, maximum gap).
- Engine: `@bessel/access` (geometry finders + `SpiceWindow` algebra) and
  `@bessel/coverage` (`figureOfMerit`).
- Limits: the UI wires the line-of-sight-to-Sun case; the library also supports
  range, elevation, range-rate, and chained constraints (see the Report and
  ground-station tools).

### Downlink Eb/N0 (link budget)
- Inputs: spacecraft to Earth range over a day; a representative DSN 34 m X-band
  station (EIRP 90 dBW, G/T 53 dB/K, 8.4 GHz, 14 kbps).
- Computes: the downlink Eb/N0 (dB) over time.
- Engine: batched `spkpos` for geometry plus `@bessel/rf` (Friis path loss,
  antenna gain, link-budget roll-up; ITU-R rain/gaseous attenuation and a typed
  comm-entity schema are available in the package).
- Validation: link math against textbook/ITU anchors.

### Conjunction (closest approach + Pc)
- Inputs: the relative state of the central body with respect to the spacecraft
  at the current epoch; an illustrative 1 km position sigma and 100 m combined
  hard-body radius.
- Computes: time of closest approach, miss distance, relative speed, and the 2D
  probability of collision.
- Engine: `@bessel/conjunction` (rectilinear closest approach; Foster 2D Pc). The
  package also provides full 2x2-covariance Pc (Mahalanobis), B-plane projection,
  Alfano maximum Pc, STM covariance propagation to the time of closest approach, and
  all-vs-all screening (`screenAllVsAll`), the latter run off the main thread in a
  dedicated (single) Web Worker with progress and cancel (`apps/web/src/screening.worker.ts`).
- Validation: Pc against the analytic centered-circular form.
- Limits: this button demonstrates the math on the loaded pair; the operational
  all-vs-all screening is exercised through the screening worker rather than this
  demo button.

### Walker constellation design
- Inputs: a Walker Delta 24/3/1 pattern at 700 km, 53 deg inclination.
- Computes: the generated constellation structure (planes, satellites per plane).
- Engine: `@bessel/coverage` (`walkerConstellation`).
- Limits: this button is pure element-set generation; a flown coverage grid sweep
  is available via `sweepCoverageGrid` (with area-weighted FOM and revisit/
  response-time statistics) and renders as a camera-relative contour overlay on the
  globe (the Coverage grid tool, `engine.computeCoverageGrid`).

### Attitude slew
- Inputs: a slew from a nadir-pointing to a Sun-pointing attitude at the current
  epoch, honoring a 2 deg/s max rate and 0.5 deg/s^2 max acceleration.
- Computes: the eigen-axis slew angle (deg) over time.
- Engine: `@bessel/attitude` (two-vector laws via `twovec`, eigen-axis slew).

### Lambert transfer
- Inputs: the spacecraft's current position about the central body to a point a
  quarter revolution ahead, over a quarter of the circular period at that radius.
- Computes: the departure delta-v of the connecting Lambert arc.
- Engine: `@bessel/mission` (universal-variable Lambert).
- Validation: Lambert against Vallado example 7-5.

### Ground track
- Inputs: the spacecraft sub-point in the central body's body-fixed frame over a
  day.
- Computes: the sub-spacecraft longitude/latitude track on a 2D map.
- Engine: the `evalSeries` `subPointLonLat` provider; projected by
  `@bessel/map-projection` in the `GroundTrackMap` overlay.
- Validation: Web Mercator against EPSG:3857.

### Export CCSDS OEM
- Inputs: the spacecraft trajectory over the loaded window (sampled).
- Computes: a CCSDS Orbit Ephemeris Message (KVN) file, downloaded.
- Engine: `@bessel/interop` (`writeOem`, round-trip tested against `parseOem`).

---

## Propagate menu

### Propagate sample TLE (SGP4)
- Inputs: the bundled SGP4-VER sample two-line element set.
- Computes: SGP4 over one day, published as an in-memory SPK Type-13 segment;
  read back as an altitude time series, a ground track, and the orbit period.
- Engine: `@bessel/propagator` (SGP4) plus `publishEphemeris` (`spkw13`).
- Validation: SGP4 against the AIAA-2006-6753 SGP4-VER reference vectors
  (sub-meter); the publish round-trip reproduces the SGP4 state via `spkezr`.
- Limits: near-Earth SGP4 only (no deep-space SDP4); TEME published as J2000.

### Ground-station access
- Inputs: the propagated satellite, a Goldstone-class station, a 10 deg elevation
  mask intersected with a geocentric range gate; a 12-hour span at a 2-minute
  step.
- Computes: the visible-pass intervals and a figure of merit (pass count,
  coverage percent).
- Engine: `@bessel/access` (`computeElevationAccess` + `gfdist`, intersected with
  the window algebra) and `@bessel/coverage`.
- Validation: elevation access against solar rise/set at a known mask.

### Propagate numerically (HPOP)
- Inputs: the same TLE initial state, integrated over one day, plus a force-model
  selector (point-mass / J2 / NxN gravity / drag / SRP) and a frame note.
- Computes: a numerical altitude time series, to compare against SGP4.
- Engine: `@bessel/propagator` Cowell propagator (adaptive Dormand-Prince 5(4))
  with the selected force model (point-mass, zonal/NxN spherical harmonics,
  atmospheric drag, or solar radiation pressure).
- Validation: the integrator reproduces CSPICE `prop2b` for a pure point-mass to
  sub-meter; point-mass + J2 reproduces the analytic J2 secular drift
  (`secularRatesJ2`); SGP4 output is placed in J2000 via the TEME to J2000 transform.

---

## Mission Design menu

### Mission Control Sequence
- Inputs: an initial circular altitude, a coast duration, an impulsive prograde
  delta-v, and a target radius for the differential corrector.
- Computes: runs an MCS (initial state, propagate, impulsive maneuver, target/coast)
  through `@bessel/propagator` `runMission`, renders the resulting trajectory in the
  3D scene (camera-relative), and shows the final state, an altitude chart, and the
  corrector convergence (`DcReport`).
- Engine: the Astrogator-class MCS executor and its differential corrector (with an
  STM-analytic or finite-difference Jacobian, nested targeting, finite burns, and an
  optional fuel-optimal gradient optimizer).
- Limits: the panel exposes a single-burn targeting demo; the underlying executor
  supports arbitrary nested sequences authored as the `Mcs` IR.

---

## Orbit Determination menu

### Batch least-squares estimate
- Inputs: a measurement-noise level for a synthetic tracking pass.
- Computes: synthesizes range/range-rate/angle measurements from a known truth
  orbit, runs the batch least-squares estimator, and shows the estimated state, the
  residual RMS, and the solution covariance.
- Engine: `@bessel/od` (Gauss-Newton batch LS seeded by the propagator STM; also
  provides an EKF, light-time/aberration, and consider parameters).
- Limits: the panel runs a synthetic-truth demo; the estimator accepts real
  measurement sets through its API.

---

## Report menu

### Report workbench
- Inputs: a provider (`range`, `rangeRate`, `speed`, `position`, `velocity`,
  `subPointLonLat`), an observer and target (from the loaded objects), a reference
  frame, and a time grid (duration and step).
- Computes: one cancellable `evalSeries` job over the SPICE worker, returning a
  unit-tagged report table (downsampled for display, the full series retained for
  export) and a CSV.
- Engine: the F3 EvalSpec interpreter and the unit-tagged `PROVIDER_CATALOG` in
  `@bessel/spice`; CSV via `@bessel/interop`.
- Limits: the duration is capped (defense against a runaway grid); heavier sweeps
  run on the dedicated SPICE compute worker.

---

## Reading results and exports

- Charts and tables display in the analysis units shown in the column headers
  (km, km/s, dB, deg, rad). The Report table downsamples for display but exports
  the full series.
- CSV files are RFC 4180 with formula-injection neutralization. CCSDS OEM exports
  are KVN and round-trip through the parser.
- Validation provenance for each engine is collected in REFERENCES.md; the
  per-domain validation and the remaining gaps are in docs/STK_PARITY_SPEC.md.

## Headless automation (batch runner)

The same engines run without the app. `@bessel/sdk` exposes a JSON batch-job IR (and
a `defineJob` builder) and a deterministic `runJob` runner; `apps/cli` wraps it as the
`bessel` command, injecting the Node PAL (`@bessel/pal-node`).

A job declares its satellites and a list of operations (furnish kernels, load a
catalog, propagate with SGP4 or two-body, run a Mission Control Sequence, analyze
range/eclipse/access/link-budget, reduce a report, and export OEM/CSV), plus an output
directory. Kernels resolve from the job file's directory; artifacts are written under
the output directory. Exit codes are CI-grade: 0 ok, 1 stopped on a failure, 2 an
invalid job, 3 completed with per-op failures, 4 a usage error.

```sh
bessel validate mission.job.json     # structural check only, exit 0 or 2
bessel run mission.job.json --out ./artifacts
```

The same job is byte-for-byte reproducible across runs, and `runJob` returns a
provenance manifest digesting every kernel and output (sha256). The MCS path (an
Astrogator-class mission sequence with a differential corrector, nested targeting,
and finite burns), the numerical substrate (dense output, event detection, the State
Transition Matrix), the NxN-gravity/drag/SRP force models, and the TEME to J2000
transform all live in `@bessel/propagator`; orbit determination (batch least-squares
and an EKF) lives in `@bessel/od`. See their READMEs and docs/STK_PARITY_SPEC.md
Section 9.
