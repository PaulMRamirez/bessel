import { contextBridge } from 'electron';

// The typed IPC surface pal-electron consumes. Phase 1 adds kernel and filesystem
// channels; Phase 3 adds meta-kernel resolution, native dialogs, and the Python
// bridge. Kept minimal and explicit so the desktop bridge stays auditable.
const api = {
  platform: 'electron' as const,
  versions: process.versions,
};

contextBridge.exposeInMainWorld('bessel', api);

export type BesselDesktopApi = typeof api;
