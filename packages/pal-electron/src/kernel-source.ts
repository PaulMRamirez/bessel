// Node filesystem KernelSource for the Electron target. In production it runs in
// the main process (or behind the typed IPC bridge); kernel bytes reach the SPICE
// engine through this source, never read by the engine directly.

import { readFile, open, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { PalError, type KernelHandle, type KernelSource } from '@bessel/pal';

export class NodeKernelSource implements KernelSource {
  constructor(private readonly baseDir: string) {}

  async list(): Promise<KernelHandle[]> {
    const entries = await readdir(this.baseDir);
    return entries.map((name) => ({ id: join(this.baseDir, name), name }));
  }

  async resolve(name: string): Promise<KernelHandle> {
    const path = join(this.baseDir, name);
    try {
      const info = await stat(path);
      return { id: path, name, size: info.size };
    } catch {
      throw new PalError(
        `Kernel "${name}" was not found under ${this.baseDir}`,
        'kernel-not-found',
        `NodeKernelSource.resolve(${name})`,
      );
    }
  }

  async read(handle: KernelHandle): Promise<Uint8Array> {
    try {
      return new Uint8Array(await readFile(handle.id));
    } catch (err) {
      throw new PalError(
        `Failed to read kernel "${handle.name}": ${err instanceof Error ? err.message : String(err)}`,
        'read-failed',
        `NodeKernelSource.read(${handle.name})`,
      );
    }
  }

  async readRange(handle: KernelHandle, offset: number, length: number): Promise<Uint8Array> {
    const fd = await open(handle.id, 'r');
    try {
      const buffer = new Uint8Array(length);
      const { bytesRead } = await fd.read(buffer, 0, length, offset);
      return buffer.subarray(0, bytesRead);
    } finally {
      await fd.close();
    }
  }
}
