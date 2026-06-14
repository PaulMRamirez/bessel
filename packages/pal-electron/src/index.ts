// @bessel/pal-electron: the Electron Platform implementation. Node filesystem
// over a typed IPC bridge from preload, with meta-kernel (.tm) path resolution
// for desktop parity (Phase 3) and the optional Python scripting bridge. The
// Capabilities advertise the Python bridge as present on Electron only.

import type { Capabilities } from '@bessel/pal';

export { NodeKernelSource } from './kernel-source.ts';

export const electronCapabilities: Capabilities = {
  target: 'electron',
  pythonBridge: true,
  webxr: false,
  nativeShare: true,
  fileDialogs: true,
};
