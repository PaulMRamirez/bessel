// @bessel/scene: builds and updates the Three.js scene graph from catalog plus
// SPICE state, with camera-relative rendering (mandatory, CLAUDE.md). Phase 0
// renders textured planet globes and a spacecraft trajectory polyline.

export const SCENE_PLACEHOLDER = true;

/** Camera modes the controller supports (SPEC 5.3). */
export type CameraMode = 'orbit' | 'center' | 'track';
