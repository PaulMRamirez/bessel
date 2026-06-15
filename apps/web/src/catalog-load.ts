// Catalog ingestion: parse a dropped or picked file as either a native Bessel
// catalog or a Cosmographia catalog, validate it, and reduce it to the object
// list the browser shows. Invalid input fails loudly with a located message
// (CLAUDE.md: loud, typed errors, never a silent fallback).

import {
  CatalogError,
  parseBesselCatalog,
  parseCosmographiaCatalog,
  type BesselCatalog,
} from '@bessel/catalog';
import { INNER_SYSTEM } from '@bessel/scene';
import type { CatalogEntry } from '@bessel/ui';

export type CatalogKind = 'native' | 'cosmographia';

export interface LoadedCatalog {
  readonly name: string;
  readonly kind: CatalogKind;
  readonly entries: readonly CatalogEntry[];
}

/** The bundled Cassini demo object list, used until a catalog is loaded. */
export const DEFAULT_OBJECT_ENTRIES: readonly CatalogEntry[] = [
  ...INNER_SYSTEM.map((p) => ({ id: p.name, name: p.name, kind: 'body' as const })),
  { id: 'Cassini', name: 'Cassini', kind: 'spacecraft' },
  { id: 'CASSINI_ISS_WAC', name: 'ISS Wide Angle', kind: 'instrument' },
];

export function parseAnyCatalog(filename: string, text: string): LoadedCatalog {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new CatalogError(`Not valid JSON: ${err instanceof Error ? err.message : String(err)}`, '$');
  }

  if (isRecord(raw) && Array.isArray(raw['items'])) {
    const sc = parseCosmographiaCatalog(raw);
    return {
      name: sc.name || filename,
      kind: 'cosmographia',
      entries: [{ id: sc.name, name: sc.name, kind: 'spacecraft' }],
    };
  }

  if (isRecord(raw) && typeof raw['version'] === 'string') {
    const catalog = parseBesselCatalog(raw);
    return {
      name: catalog.name || filename,
      kind: 'native',
      entries: nativeEntries(catalog),
    };
  }

  throw new CatalogError(
    'Unrecognized catalog: expected a Cosmographia "items" array or a native "version" field',
    '$',
  );
}

function nativeEntries(catalog: BesselCatalog): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  for (const b of catalog.bodies ?? []) {
    entries.push({ id: b.id, name: b.name ?? b.id, kind: 'body' });
  }
  for (const s of catalog.spacecraft ?? []) {
    entries.push({ id: s.id, name: s.name ?? s.id, kind: 'spacecraft' });
  }
  for (const inst of catalog.instruments ?? []) {
    entries.push({ id: inst.id, name: inst.id, kind: 'instrument' });
  }
  return entries;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Format a load failure for display, including the located field for catalog errors. */
export function formatLoadError(err: unknown): string {
  if (err instanceof CatalogError) return `${err.location}: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
