// Cosmographia catalog compatibility (ADR-0006). Phase 0 supports the SPICE
// trajectory subset needed to render a spacecraft path; Phase 1 widens this to
// the full geometry taxonomy. Bad references fail loudly with a located error.

import { CatalogError, type SpacecraftCatalog } from './index.ts';

export interface CosmographiaSpiceTrajectory {
  readonly type: 'Spice';
  readonly target: string;
  readonly center: string;
  readonly frame?: string;
}

export interface CosmographiaItem {
  readonly class?: string;
  readonly name: string;
  readonly startTime?: string;
  readonly endTime?: string;
  readonly trajectory: CosmographiaSpiceTrajectory;
}

export interface CosmographiaCatalog {
  readonly version?: string;
  readonly name: string;
  readonly spiceKernels?: readonly string[];
  readonly items: readonly CosmographiaItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requireString(value: unknown, location: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new CatalogError(`Expected a non-empty string at ${location}`, location);
  }
  return value;
}

/**
 * Parse a Cosmographia catalog and return the first spacecraft as a typed
 * SpacecraftCatalog. Throws a located CatalogError on any bad reference rather
 * than silently re-centering (the loud-failure principle, CLAUDE.md).
 */
export function parseCosmographiaCatalog(raw: unknown): SpacecraftCatalog {
  if (!isRecord(raw)) throw new CatalogError('Catalog root must be an object', '$');
  // Validate the catalog name is present (fail loud) even though the spacecraft
  // item name is what we return.
  requireString(raw['name'], '$.name');

  const items = raw['items'];
  if (!Array.isArray(items) || items.length === 0) {
    throw new CatalogError('Catalog must have a non-empty items array', '$.items');
  }

  const index = items.findIndex(
    (item) => isRecord(item) && (item['class'] === 'spacecraft' || 'trajectory' in item),
  );
  if (index < 0) {
    throw new CatalogError('No spacecraft item found in catalog', '$.items');
  }
  const item = items[index] as Record<string, unknown>;
  const loc = `$.items[${index}]`;

  const trajectory = item['trajectory'];
  if (!isRecord(trajectory)) {
    throw new CatalogError('Spacecraft item is missing a trajectory', `${loc}.trajectory`);
  }
  if (trajectory['type'] !== 'Spice') {
    throw new CatalogError(
      `Unsupported trajectory type "${String(trajectory['type'])}" (Phase 0 supports "Spice")`,
      `${loc}.trajectory.type`,
    );
  }

  const spiceId = requireString(trajectory['target'], `${loc}.trajectory.target`);
  const center = requireString(trajectory['center'], `${loc}.trajectory.center`);
  const frame = typeof trajectory['frame'] === 'string' ? trajectory['frame'] : 'J2000';

  const kernelsRaw = raw['spiceKernels'];
  const kernels =
    kernelsRaw === undefined
      ? []
      : Array.isArray(kernelsRaw)
        ? kernelsRaw.map((k, i) => requireString(k, `$.spiceKernels[${i}]`))
        : (() => {
            throw new CatalogError('spiceKernels must be an array', '$.spiceKernels');
          })();

  return {
    name: requireString(item['name'], `${loc}.name`),
    spiceId,
    frame,
    center,
    kernels,
    ...(typeof item['startTime'] === 'string' ? { startTime: item['startTime'] } : {}),
    ...(typeof item['endTime'] === 'string' ? { endTime: item['endTime'] } : {}),
  };
}
