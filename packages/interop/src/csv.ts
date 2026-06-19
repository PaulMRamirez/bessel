// CSV export for analysis products: a column time series (an EvalSeries result) and
// an interval window (an access/eclipse Gantt). Pure and dependency-free: the shapes
// are plain arrays so this does not pull in @bessel/spice or @bessel/timeline. The
// workbench and the analysis panels export through these. (STK_PARITY_SPEC §4.10.)

/** Quote a CSV field when it contains a comma, quote, or newline (RFC 4180). */
function quoteField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Format a text cell, neutralizing spreadsheet formula injection: a value beginning
 * with a formula trigger (=, +, -, @, tab, CR) is prefixed with a single quote so a
 * spreadsheet treats it as text, not a formula. Numbers are not escaped (a negative
 * number is data, not a formula), so they keep their leading minus.
 */
function textCell(value: string): string {
  const escaped = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return quoteField(escaped);
}

function csvRow(fields: readonly (string | number)[]): string {
  return fields.map((f) => (typeof f === 'number' ? quoteField(String(f)) : textCell(f))).join(',');
}

export interface SeriesCsvOptions {
  /** Header for the epoch column (default "et"). */
  readonly epochHeader?: string;
  /** Optional pre-formatted epoch labels (e.g. UTC strings) used instead of `et`. */
  readonly epochLabels?: readonly string[];
  /** Significant digits for numeric cells (default 6). */
  readonly digits?: number;
}

/**
 * Serialize a column time series to CSV: one header row (epoch + column names) and
 * one row per sample. `columns` are aligned to `et` and named by `names`.
 */
export function seriesToCsv(
  et: ArrayLike<number>,
  columns: readonly ArrayLike<number>[],
  names: readonly string[],
  opts: SeriesCsvOptions = {},
): string {
  const digits = opts.digits ?? 6;
  const round = (v: number): number => Number(v.toPrecision(digits));
  const header = csvRow([opts.epochHeader ?? 'et', ...names]);
  const rows: string[] = [header];
  for (let i = 0; i < et.length; i++) {
    const epoch = opts.epochLabels ? opts.epochLabels[i] ?? '' : round(et[i]!);
    rows.push(csvRow([epoch, ...columns.map((c) => round(c[i]!))]));
  }
  return rows.join('\n') + '\n';
}

export interface IntervalsCsvOptions {
  readonly startHeader?: string;
  readonly stopHeader?: string;
  /** Optional formatter from ET seconds to a label (e.g. UTC). Default is the number. */
  readonly format?: (et: number) => string;
}

/**
 * Serialize interval windows to CSV: start, stop, and duration (s) per interval.
 */
export function intervalsToCsv(
  intervals: readonly (readonly [number, number])[],
  opts: IntervalsCsvOptions = {},
): string {
  const fmt = opts.format ?? ((v: number): string => String(v));
  const rows: string[] = [csvRow([opts.startHeader ?? 'start', opts.stopHeader ?? 'stop', 'duration_s'])];
  for (const [start, stop] of intervals) {
    rows.push(csvRow([fmt(start), fmt(stop), Number((stop - start).toPrecision(6))]));
  }
  return rows.join('\n') + '\n';
}
