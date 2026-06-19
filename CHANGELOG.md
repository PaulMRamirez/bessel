# Changelog

All notable changes to Bessel are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Per-release entries are aggregated from the Changesets under `.changeset/` by the
release pipeline (`pnpm release:dry` previews it); the Unreleased section below is
maintained alongside them, not hand-edited per package.

## [Unreleased]

### Added

- Mission-analysis engine layer, surfaced in three viewer workbenches:
  - Analysis menu: eclipse/umbra intervals, range time series, Sun line-of-sight
    access with a coverage figure of merit, downlink Eb/N0 link budget,
    conjunction time-of-closest-approach and 2D probability of collision,
    Walker-Delta constellation design, eigen-axis attitude slew, Lambert transfer
    delta-v, ground track, and CCSDS OEM export, each with CSV export.
  - Propagate menu: SGP4 propagation of a sample TLE into an in-memory SPK with
    altitude/ground-track readback, ground-station access, and a native Cowell
    HPOP (adaptive DOPRI5 with a point-mass + J2 force model).
  - Report workbench: a unit-tagged data-provider registry driving cancellable
    `evalSeries` jobs into report tables and CSV.
- New core analysis packages: `@bessel/propagator`, `access`, `events`, `rf`,
  `coverage`, `conjunction`, `attitude`, `sensors`, `mission`, `map-projection`,
  `interop`, `analysis`, and `terrain`.
- F3 foundation in `@bessel/spice`: an EvalSpec time-series interpreter, a
  cancellable-job protocol, a multi-worker SPICE pool, and `recgeo`/`et2lst`
  bindings; the `SpiceWindow` interval algebra and a shared geometry finder in
  `@bessel/timeline`.
- Interop: CCSDS OEM/OMM/CDM parse, OEM-to-SPK import, and CSV/CZML export.
- Documentation: a getting-started guide, an analysis-tools reference, an
  architecture overview, a build-from-source guide, and a docs index.

### Notes

- Every analysis quantity is validated against an independent numeric reference
  (see REFERENCES.md and docs/STK_PARITY_SPEC.md).
- Earlier work (the Cosmographia parity closure) is recorded in
  docs/PARITY_MATRIX.md Section 15.

[Unreleased]: https://github.com/PaulMRamirez/bessel/commits/main
