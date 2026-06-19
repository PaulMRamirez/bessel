// The single headless execution entry. Validates the job, opens a SPICE engine, resolves
// references, then executes operations in order against an injected RunIo (the PAL seam),
// writing artifacts and recording a per-op result. Operational failures are recorded and
// mapped to an exit code; only programmer error throws. (STK_PARITY_SPEC, SDK.)

import { createSpiceEngine } from '@bessel/spice';
import { createMissionEnv } from '@bessel/propagator';
import { JobReferenceError, SdkError } from '../errors.ts';
import { validateJob } from '../job/validate.ts';
import type { BatchJob, EntityDecl, Operation } from '../job/types.ts';
import { BODY_GM } from './bodies.ts';
import type { OpContext, ResolvedDefaults, RunIo } from './context.ts';
import type { OpResult } from './results.ts';
import { runFurnish } from '../ops/furnish.ts';
import { runPropagate } from '../ops/propagate.ts';
import { runRunMcs } from '../ops/run-mcs.ts';
import { runAnalyzeRange } from '../ops/analyze-range.ts';
import { runExportOem } from '../ops/export-oem.ts';
import { runExportCsv } from '../ops/export-csv.ts';

export type { RunIo } from './context.ts';

export interface RunRequest {
  readonly job: BatchJob;
  readonly io: RunIo;
  readonly dryRun?: boolean;
  readonly signal?: AbortSignal;
}

export interface OpRecord {
  readonly index: number;
  readonly op: string;
  readonly id?: string;
  readonly status: 'ok' | 'failed' | 'skipped';
  readonly outputs: readonly string[];
  readonly error?: { readonly code: string; readonly message: string; readonly location?: string };
}

export interface RunResult {
  readonly status: 'ok' | 'failed' | 'completed-with-failures';
  readonly exitCode: 0 | 1 | 3;
  readonly ops: readonly OpRecord[];
}

export interface RunSummary {
  readonly status: RunResult['status'];
  readonly ops: readonly OpRecord[];
}

const producerId = (op: Operation): string | undefined =>
  op.op === 'propagate' || op.op === 'runMcs' || op.op === 'analyze' ? op.id : undefined;

const fileOf = (op: Operation): string | undefined =>
  op.op === 'exportOem' || op.op === 'exportCsv' ? op.file : undefined;

export async function runJob(req: RunRequest): Promise<RunResult> {
  const job = validateJob(req.job);
  const ops = job.operations;
  const producers = new Set<string>();
  for (const op of ops) {
    const id = producerId(op);
    if (id) producers.add(id);
  }
  // Reference pass: an export's `from` must name a declared producer; nothing executes yet.
  ops.forEach((op, i) => {
    if (op.op === 'exportOem' || op.op === 'exportCsv') {
      if (!producers.has(op.from)) throw new JobReferenceError(`export references unknown producer "${op.from}"`, `/operations/${i}/from`, op.from);
    }
  });

  if (req.dryRun) {
    return { status: 'ok', exitCode: 0, ops: ops.map((op, i) => ({ index: i, op: op.op, id: producerId(op), status: 'skipped', outputs: [] })) };
  }

  const engine = await createSpiceEngine();
  try {
    return await execute(job, ops, engine, req.io, req.signal);
  } finally {
    await engine.kclear();
  }
}

async function execute(
  job: BatchJob,
  ops: readonly Operation[],
  engine: Awaited<ReturnType<typeof createSpiceEngine>>,
  io: RunIo,
  signal?: AbortSignal,
): Promise<RunResult> {
  const defaults: ResolvedDefaults = { frame: job.defaults?.frame ?? 'J2000', center: job.defaults?.center ?? 'EARTH' };
  const entities = new Map<string, EntityDecl>(Object.entries(job.entities ?? {}));
  const registry = new Map<string, OpResult>();
  const env = createMissionEnv(BODY_GM);
  const onError = job.output.onError ?? 'stop';

  const records: OpRecord[] = [];
  let anyFailure = false;
  let stopped = false;

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!;
    if (stopped) {
      records.push({ index: i, op: op.op, id: producerId(op), status: 'skipped', outputs: [] });
      continue;
    }
    const ctx: OpContext = { engine, io, registry, entities, defaults, env, signal };
    try {
      const result = await dispatch(op, ctx);
      const id = producerId(op);
      if (id) registry.set(id, result);
      const outputs = fileOf(op);
      records.push({ index: i, op: op.op, id, status: 'ok', outputs: outputs ? [outputs] : [] });
    } catch (e) {
      anyFailure = true;
      records.push({ index: i, op: op.op, id: producerId(op), status: 'failed', outputs: [], error: errorInfo(e) });
      if (onError === 'stop') stopped = true;
    }
  }

  if (stopped) return { status: 'failed', exitCode: 1, ops: records };
  if (anyFailure) return { status: 'completed-with-failures', exitCode: 3, ops: records };
  return { status: 'ok', exitCode: 0, ops: records };
}

function dispatch(op: Operation, ctx: OpContext): Promise<OpResult> {
  switch (op.op) {
    case 'furnish':
      return runFurnish(op, ctx);
    case 'propagate':
      return runPropagate(op, ctx);
    case 'runMcs':
      return runRunMcs(op, ctx);
    case 'analyze':
      return runAnalyzeRange(op, ctx);
    case 'exportOem':
      return runExportOem(op, ctx);
    case 'exportCsv':
      return runExportCsv(op, ctx);
  }
}

function errorInfo(e: unknown): { code: string; message: string; location?: string } {
  if (e instanceof SdkError) return { code: e.code, message: e.message, location: e.location };
  if (e instanceof Error) return { code: e.name, message: e.message };
  return { code: 'unknown', message: String(e) };
}
