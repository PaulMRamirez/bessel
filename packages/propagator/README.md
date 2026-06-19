# @bessel/propagator

Orbit propagation and TLE/OMM/OEM ingest for Bessel: analytic propagators
(two-body, J2/J4 mean-element, SGP4) plus a Cowell numerical propagator (adaptive
DOPRI5 with a pluggable force model). On top of the integrator it adds the
numerical substrate (dense output, event detection, the State Transition Matrix),
an Astrogator-class Mission Control Sequence with a differential corrector, and the
EOP-aware TEME to J2000 frame transform. Core layer; it reuses CSPICE prop2b/conics
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
  `ForceModel`, `ForceTerm`, `ForceContext`, `Vector3`, `Mat3`, `AccelPartials`
  types (the analytic acceleration-partials seam).
- `IntegrationError`, `OutOfDomainError`, `EventError`, `StmUnsupportedError`.

Numerical substrate (built on the integrator):

- `propagateCowellEx`, `CowellResult`: the extended Cowell run exposing a continuous
  solution, located events, terminal-stop truncation, and `stmAt(et)`.
- `integrateDense`, `Solution`, `Segment`, `DenseOptions`, `DenseResult`: continuous
  (cubic-Hermite) output over the whole arc.
- `scanSegmentEvents`, `EventSpec`, `EventHit`: switching-function event detection
  with Brent root-finding, direction filtering, and terminal stops.
- `augmentInitialState`, `makeStmRhs`, `stmFromState`, `STM_DIM`: the 42-state
  variational equations for the State Transition Matrix.

Mission Control Sequence (`mcs/`, Astrogator-class):

- `runMission`, `runMcs`, `runSegment`, `McsRun`: execute a mission sequence.
- `validateMcs`, the `Mcs` IR (`Segment`, `StopCondition`, `ControlVar`, `Goal`,
  `DcSettings`, `DEFAULT_DC_SETTINGS`).
- `createMissionEnv`, `MissionEnv`, `BodyDynamics`: the SPICE-free dynamics seam.
- `runDifferentialCorrector`, `DcReport`, and the `McsError` family. Targets nest: a
  Target child inside another Target solves its own corrector to convergence as part of
  evaluating the outer residual (an inner loop per outer iteration), and both `DcReport`s
  surface on the run.
- Finite (continuous-thrust) burns: a `Maneuver` with `mode: 'Finite'` carries `isp` (s),
  `thrustN` (N), and `duration` (s); its `dv` gives only the thrust DIRECTION (in the
  `attitude` frame, frozen at ignition). `runFiniteBurn` integrates a 7-state arc
  `[r, v, m]` under the central-body force model plus a constant-thrust term, with the mass
  co-integrated via `dm/dt = -T / (Isp * g0)`, so `a_thrust = (T / m(t)) * dirHat` tracks
  the true instantaneous mass. The post-burn state and depleted mass flow into the next
  segment; impulsive burns are unchanged. A finite burn's `duration` or `thrustN` may be a
  corrector control (`Maneuver.duration`, `Maneuver.thrustN`), taken on the
  finite-difference Jacobian columns. `constantThrust` exposes the bare force term.

Frames (`frames/`):

- `temeToJ2000`, `temeToJ2000AtEt`, `j2000ToTeme`, `temeToJ2000Matrix`,
  `EarthOrientation` (the `ddpsi`/`ddeps` celestial-pole offsets), plus the IAU-1976
  `precession` and IAU-1980 `nutation` primitives.

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
- `dense.test.ts`: the continuous extension reproduces prop2b off-grid to
  sub-meter, conserves energy along the interpolant, and guards its domain.
- `events.test.ts`: closed-form switching functions (periapsis at `r.v = 0`, node
  crossing at `z = 0`), direction filtering, and terminal truncation.
- `stm.test.ts`: the STM matches a central finite-difference of the flow for
  point-mass and J2, with `det(Phi) = 1`, identity seeding, and the unsupported-term
  guard.
- `mcs/**/*.test.ts`: the differential corrector converges against the vis-viva
  delta-v, a flight-path-angle null, and a pure-STM (zero finite-difference)
  downrange-radius oracle, plus fail-loud payloads. `finite-burn.test.ts` checks the
  rocket-equation delta-v and mass change and the quadratic convergence to the impulsive
  limit; `executor.depth.test.ts` targets a finite-burn duration to a downstream apoapsis
  and runs a nested (multi-level) corrector where an inner Target nulls a condition while an
  outer Target hits a radius.
- `frames/teme.test.ts`: TEME to J2000 validated to sub-meter against the Vallado
  teme2eci worked example, with orthonormality and round-trip oracles.
- `tle.test.ts`, `omm.test.ts`, `oem-import.test.ts`, `sgp4-publish.test.ts`,
  `publish.test.ts`, `propagator.test.ts`, `force-model.test.ts`,
  `third-body.test.ts`.

## Algorithm and references

- SGP4: Hoots & Roehrich, Spacetrack Report No. 3, and Vallado et al., "Revisiting
  Spacetrack Report #3" (AIAA 2006-6753), which also supplies the SGP4-VER vectors.
- Two-body and J2/J4 mean-element theory: Vallado, "Fundamentals of Astrodynamics
  and Applications."
- Cowell integrator, dense output, and the variational/STM equations: Hairer,
  Norsett & Wanner (Dormand-Prince 5(4) / DOPRI5 tableau, adaptive step control, and
  continuous extension); Montenbruck & Gill, "Satellite Orbits" (special
  perturbations, zonal harmonics, third-body, and the state transition matrix).
- MCS and differential correction: the STK Astrogator targeting model (control
  variables, goals, Newton-Raphson with an STM Jacobian).
- TEME to J2000: Vallado, Crawford, Hujsak & Kelso, "Revisiting Spacetrack Report
  #3" (AIAA 2006-6753), with IAU-1976 precession and the full IAU-1980 nutation
  series (ERFA `nut80`).
- OMM/OEM messages: CCSDS 502.0-B, Orbit Data Messages.

See REFERENCES.md (repo root) and docs/STK_PARITY_SPEC.md for full provenance.

## Status / limitations

Force terms implemented: point-mass, zonal harmonics (J2/J4), and third-body;
drag and SRP are not yet implemented. Mean-element propagation covers J2/J4 secular
rates only (no periodic terms). The MCS corrector supports nested (multi-level) targeting
and finite (continuous-thrust) burns with mass depletion; gradient optimizers are still
pending. The TEME to J2000 transform takes the celestial-pole EOP offsets but the time
argument is TT approximated from TDB (sub-millisecond).
