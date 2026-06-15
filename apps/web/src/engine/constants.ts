// Tunables shared by the engine and the viewer chrome. Scene units are 1e6 km;
// the focus distances frame each target (Saturn and Cassini show the orbit
// close-up, the others the heliocentric system).

export const STEPS = 120;

export const CENTER_TARGETS = ['Sun', 'Earth', 'Jupiter', 'Saturn', 'Cassini'] as const;

export const FOCUS_DISTANCE: Readonly<Record<string, number>> = {
  Sun: 2200,
  Earth: 320,
  Jupiter: 1200,
  Saturn: 0.7,
  Cassini: 0.35,
};

/** Default framing distance for a body not in FOCUS_DISTANCE. */
export const DEFAULT_FOCUS_DISTANCE = 600;

export const RATE_STEPS = [1, 60, 3600, 86400, 604800] as const;
