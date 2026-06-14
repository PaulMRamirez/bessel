// Catalog validation against bessel-catalog.schema.json (JSON Schema Draft
// 2020-12) plus cross-reference checks. Invalid catalogs fail loudly with a
// located CatalogError naming the offending field, never silently.

import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../schema/bessel-catalog.schema.json';
import { CatalogError } from './index.ts';
import type { BesselCatalog } from './native-types.ts';

let validateFn: ValidateFunction | null = null;

function validator(): ValidateFunction {
  if (validateFn) return validateFn;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  validateFn = ajv.compile(schema);
  return validateFn;
}

/** True when the schema itself passes Draft 2020-12 meta-validation. */
export function schemaIsValid(): boolean {
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  return ajv.validateSchema(schema) === true;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ErrorObject[];
}

export function validateCatalog(raw: unknown): ValidationResult {
  const validate = validator();
  const valid = validate(raw) === true;
  return { valid, errors: valid ? [] : (validate.errors ?? []) };
}

/**
 * Validate and return the typed native catalog, or throw a located CatalogError.
 * Also checks cross references: instrument.parent and observation.instrument must
 * resolve, and spacecraft single-arc vs multi-arc exclusivity (enforced by the
 * schema oneOf) is surfaced with a clear message.
 */
export function parseBesselCatalog(raw: unknown): BesselCatalog {
  const { valid, errors } = validateCatalog(raw);
  if (!valid) {
    const first = errors[0];
    const location = first?.instancePath || '$';
    const message = first ? `${first.instancePath || '$'} ${first.message}` : 'Invalid catalog';
    throw new CatalogError(message, location);
  }
  const catalog = raw as BesselCatalog;
  checkReferences(catalog);
  return catalog;
}

function checkReferences(catalog: BesselCatalog): void {
  const ids = new Set<string>();
  for (const b of catalog.bodies ?? []) ids.add(b.id);
  for (const s of catalog.spacecraft ?? []) ids.add(s.id);

  const instrumentIds = new Set<string>();
  (catalog.instruments ?? []).forEach((inst, i) => {
    instrumentIds.add(inst.id);
    if (!ids.has(inst.parent)) {
      throw new CatalogError(
        `Instrument "${inst.id}" references unknown parent "${inst.parent}"`,
        `$.instruments[${i}].parent`,
      );
    }
  });

  (catalog.observations ?? []).forEach((obs, i) => {
    if (!instrumentIds.has(obs.instrument)) {
      throw new CatalogError(
        `Observation references unknown instrument "${obs.instrument}"`,
        `$.observations[${i}].instrument`,
      );
    }
  });
}
