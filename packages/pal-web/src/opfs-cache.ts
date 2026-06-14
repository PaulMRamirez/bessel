// OPFS-backed kernel cache. Kernels are content-addressed by their stable id so a
// cached kernel survives reloads and enables offline operation (completed in
// Phase 2). When OPFS is unavailable (older browsers, some private modes) the
// cache is simply absent and the KernelSource falls back to the network.

export interface KernelCache {
  get(id: string): Promise<Uint8Array | null>;
  put(id: string, bytes: Uint8Array): Promise<void>;
}

const CACHE_DIR = 'kernels';

export class OpfsKernelCache implements KernelCache {
  constructor(private readonly dir: FileSystemDirectoryHandle) {}

  private safe(id: string): string {
    return id.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  async get(id: string): Promise<Uint8Array | null> {
    try {
      const handle = await this.dir.getFileHandle(this.safe(id), { create: false });
      const file = await handle.getFile();
      return new Uint8Array(await file.arrayBuffer());
    } catch {
      return null;
    }
  }

  async put(id: string, bytes: Uint8Array): Promise<void> {
    const handle = await this.dir.getFileHandle(this.safe(id), { create: true });
    const writable = await handle.createWritable();
    await writable.write(bytes);
    await writable.close();
  }
}

/** Open the OPFS kernel cache, or return undefined when OPFS is unavailable. */
export async function openKernelCache(): Promise<KernelCache | undefined> {
  const storage = globalThis.navigator?.storage as
    | { getDirectory?: () => Promise<FileSystemDirectoryHandle> }
    | undefined;
  if (!storage?.getDirectory) return undefined;
  try {
    const root = await storage.getDirectory();
    const dir = await root.getDirectoryHandle(CACHE_DIR, { create: true });
    return new OpfsKernelCache(dir);
  } catch {
    return undefined;
  }
}
