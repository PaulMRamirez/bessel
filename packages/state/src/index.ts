// @bessel/state: the view model and its URL serialization. Phase 2 implements the
// compact fragment codec; this is the typed shape it round-trips.

export interface CameraPose {
  readonly mode: 'orbit' | 'center' | 'track';
  readonly target?: string;
  readonly distance: number;
  readonly azimuth: number;
  readonly elevation: number;
}

export interface ViewModel {
  readonly et: number;
  readonly camera: CameraPose;
  readonly selection: readonly string[];
  readonly visibility: Readonly<Record<string, boolean>>;
  readonly plugins: readonly string[];
}

export const DEFAULT_VIEW: ViewModel = {
  et: 0,
  camera: { mode: 'orbit', distance: 1, azimuth: 0, elevation: 0 },
  selection: [],
  visibility: {},
  plugins: [],
};
