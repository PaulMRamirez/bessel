# @bessel/propagator

Orbit propagation and TLE/OMM/OEM ingest for Bessel: analytic propagators
(two-body, J2/J4 mean-element, SGP4) plus a Cowell numerical propagator (adaptive
DOPRI5 with a pluggable force model). Core layer; it reuses CSPICE prop2b/conics
math via @bessel/spice and depends on nothing higher.

## Public API

TLE and message ingest:

- `parseTle`, `TleError`, `Tle`: two-line element parsing.
- `parseOmm`, `ommToTle`, `OmmError`, `Omm`: CCSDS OMM parsing and conversion.
- `publishOem`, `OemLike`, `OemImportOptions`: import a CCSDS OEM ephemeris.

Analytic propagation:

- `sgp4init`, `sgp4`, `SatRec`, `TemeState`: the SGP4 propagator over a parsed TLE.
- `propagateTwoBody`, `propagateMeanElements`, `secularRatesJ2`, `SecularRates`:
  Kepler two-body and J2/J4 mean-element propagation.
- `publishEphemeris`, `emptyTable`, `EphemerisTable`, `ClassicalElements`,
  `CentralBody`, `PublishOptions`.

Numerical (Cowell) propagation:

- `propagateCowell`, `CowellOptions`: special-perturbations propagation over an
  ephemeris-time grid.
- `integrate`, `Rhs`, `IntegratorOptions`: the bare adaptive DOPRI5 integrator.
- Force model: `createForceModel`, `pointMass`, `zonalHarmonics` (`ZonalBody`,
  `ZonalCoeffs`), `thirdBody`, `sampledPosition` (`PositionAt`), plus the
  `ForceModel`, `ForceTerm`, `ForceContext`, `Vector3` types.
- `IntegrationError`.

```ts
import { createForceModel, pointMass, zonalHarmonics, propagateCowell } from '@bessel/propagator';

const fm = createForceModel([pointMass(398600.4418), zonalHarmonics(earth, { j2 })]);
const table = propagateCowell({ state, epoch: 0, etGrid, forceModel: fm });
```

## Dependency rule

Depends on: `@bessel/spice` (for prop2b/conics Kepler math). Part of the core
layer; it never imports a PAL implementation or any UI package.

## Tests

Tests live in `packages/propagator/src/*.test.ts`. Numeric oracles:

- `sgp4.test.ts`: SGP4 validated against the AIAA-2006-6753 SGP4-VER reference
  TEME state vectors (catalog 5) to sub-meter / sub-mm-per-s.
- `integrator.test.ts`: the DOPRI5 Cowell integrator reproduces CSPICE prop2b for
  a point-mass force to sub-meter, conserves energy and angular momentum, and
  cross-checks against an independent fixed-step RK4 on the J2 model.
- `tle.test.ts`, `omm.test.ts`, `oem-import.test.ts`, `sgp4-publish.test.ts`,
  `publish.test.ts`, `propagator.test.ts`, `force-model.test.ts`,
  `third-body.test.ts`.

## Algorithm and references

- SGP4: Hoots & Roehrich, Spacetrack Report No. 3, and Vallado et al., "Revisiting
  Spacetrack Report #3" (AIAA 2006-6753), which also supplies the SGP4-VER vectors.
- Two-body and J2/J4 mean-element theory: Vallado, "Fundamentals of Astrodynamics
  and Applications."
- Cowell integrator: Hairer, Norsett & Wanner (Dormand-Prince 5(4) / DOPRI5 tableau
  and adaptive step control); Montenbruck & Gill, "Satellite Orbits" (special
  perturbations, zonal harmonics, third-body).
- OMM/OEM messages: CCSDS 502.0-B, Orbit Data Messages.

See REFERENCES.md (repo root) and docs/STK_PARITY_SPEC.md for full provenance.

## Status / limitations

Force terms implemented: point-mass, zonal harmonics (J2/J4), and third-body;
drag and SRP are not yet implemented. Mean-element propagation covers J2/J4 secular
rates only (no periodic terms).
