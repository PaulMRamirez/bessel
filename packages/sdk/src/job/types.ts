// The canonical Bessel batch-job IR: a fully serializable discriminated union that an
// authored JSON file parses into and the programmatic builder emits. Types only, no
// logic. Execution lives in the runner; validation in validate.ts. (STK_PARITY_SPEC, SDK.)

import type { Mcs } from '@bessel/propagator';
import type { OemMetadata } from '@bessel/interop';

export interface BatchJob {
  readonly besselBatch: '1';
  readonly meta?: { readonly name?: string; readonly description?: string };
  readonly defaults?: JobDefaults;
  readonly entities?: Readonly<Record<string, EntityDecl>>;
  readonly operations: readonly Operation[];
  readonly output: OutputDecl;
}

export interface JobDefaults {
  readonly frame?: string; // default 'J2000'
  readonly center?: string; // default 'EARTH'
}

export interface OutputDecl {
  readonly dir: string;
  /** Stop the run on the first op failure, or continue and report. Default 'stop'. */
  readonly onError?: 'stop' | 'continue';
}

/** A sampling grid: a uniform UTC span, or explicit UTC epochs. */
export type GridSpec =
  | { readonly start: string; readonly stop: string; readonly stepSec: number }
  | { readonly epochs: readonly string[] };

export type EntityDecl = { readonly type: 'satellite'; readonly source: SatelliteSource };

export type SatelliteSource =
  | { readonly kind: 'spk'; readonly target: string }
  | { readonly kind: 'tle'; readonly line1: string; readonly line2: string }
  | {
      readonly kind: 'state';
      readonly epoch: string; // UTC ISO
      readonly centralBody: number; // NAIF id
      readonly r: readonly [number, number, number]; // km
      readonly v: readonly [number, number, number]; // km/s
    };

export type Operation = FurnishOp | PropagateOp | RunMcsOp | AnalyzeOp | ExportOemOp | ExportCsvOp;

export interface FurnishOp {
  readonly op: 'furnish';
  readonly id?: string;
  readonly names: readonly string[];
}

export interface PropagateOp {
  readonly op: 'propagate';
  readonly id: string;
  /** Entity id (satellite) to propagate. */
  readonly object: string;
  readonly method: 'sgp4' | 'twobody';
  readonly grid: GridSpec;
  readonly frame?: string;
  readonly center?: string;
  /** Optionally publish the arc into the kernel pool so later ops can query it. */
  readonly publishAs?: { readonly naifId: number; readonly degree?: number };
}

export interface RunMcsOp {
  readonly op: 'runMcs';
  readonly id: string;
  readonly mcs: Mcs; // @bessel/propagator IR, verbatim
  /** Per-NAIF-body dynamics for the mission environment (gm, bodyRadius). */
  readonly bodies?: Readonly<Record<number, { readonly gm: number; readonly bodyRadius: number }>>;
  readonly center?: string;
}

export interface AnalyzeOp {
  readonly op: 'analyze';
  readonly id: string;
  readonly kind: 'range';
  readonly observer: string;
  readonly target: string;
  readonly grid: GridSpec;
  readonly frame?: string;
}

export interface ExportOemOp {
  readonly op: 'exportOem';
  readonly id?: string;
  /** Producer id of an ephemeris or MCS result. */
  readonly from: string;
  readonly file: string;
  readonly metadata?: OemMetadata;
}

export interface ExportCsvOp {
  readonly op: 'exportCsv';
  readonly id?: string;
  /** Producer id of a series result. */
  readonly from: string;
  readonly file: string;
}
