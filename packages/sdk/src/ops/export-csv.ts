// The exportCsv op: serialize a series result (from an analyze op) to CSV with UTC epoch
// labels, through the existing interop writer. (STK_PARITY_SPEC, SDK.)

import { seriesToCsv } from '@bessel/interop';
import { ExportError } from '../errors.ts';
import type { ExportCsvOp } from '../job/types.ts';
import type { OpContext } from '../runner/context.ts';
import type { OpResult } from '../runner/results.ts';

export async function runExportCsv(op: ExportCsvOp, ctx: OpContext): Promise<OpResult> {
  const src = ctx.registry.get(op.from);
  if (!src) throw new ExportError(`exportCsv source "${op.from}" was not produced by any prior op`, `from`);
  if (src.kind !== 'series') throw new ExportError(`exportCsv cannot serialize a "${src.kind}" result`, `from`);

  const labels: string[] = [];
  for (let i = 0; i < src.et.length; i++) labels.push(await ctx.engine.et2utc(src.et[i]!, 'ISOC', 6));
  const csv = seriesToCsv(src.et, src.columns, src.names, { epochHeader: 'utc', epochLabels: labels });
  await ctx.io.writeFile(op.file, new TextEncoder().encode(csv));
  return { kind: 'void' };
}
