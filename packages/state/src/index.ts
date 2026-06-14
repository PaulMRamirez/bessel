// @bessel/state: the view model and its URL serialization (SPEC 5.5, ADR-0008).
// A view encodes to a compact URL fragment and decodes back exactly, the basis
// for shareable links. The epoch is stored as ISO 8601 UTC so the fragment is
// human-meaningful and round-trips losslessly without a SPICE conversion here.

export type CameraMode = 'orbit' | 'center' | 'track';

export interface CameraPose {
  readonly mode: CameraMode;
  readonly target?: string;
  readonly distance: number;
  readonly azimuth: number;
  readonly elevation: number;
}

export interface ViewModel {
  /** Epoch as ISO 8601 UTC. */
  readonly t: string;
  readonly camera: CameraPose;
  readonly selection: readonly string[];
  readonly visibility: Readonly<Record<string, boolean>>;
  readonly plugins: readonly string[];
}

export const VIEW_VERSION = 1;

export const DEFAULT_VIEW: ViewModel = {
  t: '2004-07-01T00:00:00Z',
  camera: { mode: 'orbit', distance: 1, azimuth: 0, elevation: 0 },
  selection: [],
  visibility: {},
  plugins: [],
};

export { encodeView, decodeView } from './codec.ts';
export { buildMmgisUrl, type MmgisHandoff, type MmgisMissionConfig } from './mmgis.ts';
export { exportCzml, type CzmlOptions, type CzmlSample } from './czml.ts';
