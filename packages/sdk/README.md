# @bessel/sdk

The headless automation layer: a programmatic facade plus a serializable JSON batch-job IR and a deterministic runner that composes the Bessel compute core (load kernels, propagate, run a Mission Control Sequence, analyze, export OEM/CSV) with no UI and no browser. Core layer.

## Public API

Authoring:

- `defineJob(meta?): JobBuilder` a chainable builder (`furnish`, `satellite`, `propagate`, `runMcs`, `analyze`, `exportOem`, `exportCsv`, `output`) that lowers to the same `BatchJob` IR a hand-written JSON file parses into. `toJSON()` validates before returning.
- `validateJob(input): BatchJob` the hand-written structural validator; every failure is a `JobSchemaError` carrying a JSON pointer to the offending node (or `UnsupportedJobVersionError`).
- The `BatchJob` IR types: `Operation` (a discriminated union of `FurnishOp`, `PropagateOp`, `RunMcsOp`, `AnalyzeOp`, `ExportOemOp`, `ExportCsvOp`), `EntityDecl`, `SatelliteSource`, `GridSpec`, `JobDefaults`, `OutputDecl`.

Running:

- `runJob(req: RunRequest): Promise<RunResult>` opens a SPICE engine, validates the job, resolves references, and executes operations in order against an injected `RunIo` (the PAL seam: a `KernelSource` plus a `writeFile`). Returns a per-op record and a CI-grade exit code (0 ok, 1 stopped on failure, 3 completed with failures).
- `RunIo`, `RunRequest`, `RunResult`, `OpRecord`, `OpResult`, `BODY_GM`.

```ts
import { defineJob, runJob } from '@bessel/sdk';

const job = defineJob()
  .satellite('SAT', { kind: 'state', epoch: '2025-03-01T00:00:00', centralBody: 399, r: [7000, 0, 0], v: [0, 7.546, 0] })
  .furnish(['naif0012.tls'])
  .propagate('eph', { object: 'SAT', method: 'twobody', grid: { start: '2025-03-01T00:00:00', stop: '2025-03-01T01:00:00', stepSec: 600 } })
  .exportOem({ from: 'eph', file: 'eph.oem' })
  .output({ dir: 'out' })
  .toJSON();

const result = await runJob({ job, io }); // io: a Node PAL from @bessel/pal-node, or an in-memory test PAL
```

## Dependency rule

Depends on: `@bessel/pal` (interface only), `@bessel/spice`, `@bessel/propagator`, `@bessel/interop`. Core layer: it injects no concrete PAL; a shell (`apps/cli`) supplies the Node IO via `@bessel/pal-node`. Operations delegate to the existing compute packages (`propagateCowell`/`propagateCowellEx`, the MCS `runMission`, SGP4 with `temeToJ2000`, `writeOem`/`seriesToCsv`).

## Determinism and errors

Artifacts are byte-stable (the OEM and CSV writers and the et2utc epoch formatting are deterministic), so the same job produces identical output across runs. Every failure is a typed, located `SdkError` (`JobSchemaError`, `JobReferenceError`, `KernelResolveError`, `AnalysisInputError`, `ExportError`, `McsValidationError`); a malformed job or a dangling producer reference throws before anything executes.

## Tests

`packages/sdk/src/job/validate.test.ts` (pointer-exact rejection of malformed jobs), `builder/job-builder.test.ts` (the builder lowers to the expected IR), and the end-to-end runner specs `runner/e2e-propagate.test.ts`, `e2e-mcs.test.ts`, `e2e-analyze.test.ts` (each runs a full job with the real SPICE engine and an in-memory PAL, asserts a value oracle, and asserts byte-identical output across two runs), plus `runner/exit-codes.test.ts` (the exit-code contract).

## Status / limitations

MVP operation set: furnish, propagate (sgp4, twobody), runMcs, analyze (range), exportOem, exportCsv. Eclipse/link/report/load-catalog operations, a shipped JSON-schema file for editor autocomplete, and provenance hashing in a run manifest are documented follow-ups.
