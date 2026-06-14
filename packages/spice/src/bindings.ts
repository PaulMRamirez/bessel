// Low-level marshaling over the CSPICE-WASM module. Owns pointer lifetimes and
// the per-function calling contract. Kernel bytes are written into the Emscripten
// in-memory FS and furnsh'd by path: the engine never parses kernels itself, it
// hands paths to CSPICE, satisfying "the SPICE engine never reads kernel bytes
// directly" (the bytes arrive via the PAL, are staged here, then loaded by CSPICE).

import type { CSpiceModule } from '@bessel/spice/wasm/cspice.mjs';
import { SpiceError, type AberrationCorrection, type PositionResult, type StateVector } from './index.ts';

const KERNEL_DIR = '/kernels';

export class SpiceBindings {
  constructor(private readonly mod: CSpiceModule) {
    // Route SPICE errors to return-mode so failures surface as typed errors
    // rather than aborting the WASM runtime.
    this.call('erract_c', this.str('SET'), 0, this.str('RETURN'));
    this.call('errprt_c', this.str('SET'), 0, this.str('NONE'));
    if (!this.mod.FS.analyzePath(KERNEL_DIR).exists) this.mod.FS.mkdir(KERNEL_DIR);
  }

  private call(name: string, ...args: number[]): number {
    const fn = this.mod[`_${name}`];
    if (!fn) throw new SpiceError(`CSPICE export _${name} is not present in the build`);
    return fn(...args);
  }

  /** Allocate a NUL-terminated C string; caller frees via the scope helper. */
  private str(s: string): number {
    const n = this.mod.lengthBytesUTF8(s) + 1;
    const ptr = this.mod._malloc(n);
    this.mod.stringToUTF8(s, ptr, n);
    return ptr;
  }

  private readDouble(ptr: number): number {
    return this.mod.getValue(ptr, 'double');
  }

  private readInt(ptr: number): number {
    return this.mod.getValue(ptr, 'i32');
  }

  /** Throw a typed SpiceError if the last SPICE call failed; reset the engine. */
  private checkFailed(): void {
    if (this.call('failed_c') === 0) return;
    const shortPtr = this.mod._malloc(64);
    const longPtr = this.mod._malloc(1841);
    this.call('getmsg_c', this.str('SHORT'), 64, shortPtr);
    this.call('getmsg_c', this.str('LONG'), 1841, longPtr);
    const short = this.mod.UTF8ToString(shortPtr);
    const long = this.mod.UTF8ToString(longPtr);
    this.mod._free(shortPtr);
    this.mod._free(longPtr);
    this.call('reset_c');
    throw new SpiceError(long || short || 'SPICE call failed', short || undefined);
  }

  tkvrsn(): string {
    const ptr = this.call('tkvrsn_c', this.str('TOOLKIT'));
    return this.mod.UTF8ToString(ptr);
  }

  furnsh(name: string, bytes: Uint8Array): void {
    const path = `${KERNEL_DIR}/${name}`;
    this.mod.FS.writeFile(path, bytes);
    this.call('furnsh_c', this.str(path));
    this.checkFailed();
  }

  unload(name: string): void {
    const path = `${KERNEL_DIR}/${name}`;
    this.call('unload_c', this.str(path));
    this.checkFailed();
    if (this.mod.FS.analyzePath(path).exists) this.mod.FS.unlink(path);
  }

  kclear(): void {
    this.call('kclear_c');
    this.checkFailed();
  }

  ktotal(kind = 'ALL'): number {
    const out = this.mod._malloc(4);
    this.call('ktotal_c', this.str(kind), out);
    this.checkFailed();
    const n = this.readInt(out);
    this.mod._free(out);
    return n;
  }

  str2et(utc: string): number {
    const out = this.mod._malloc(8);
    this.call('str2et_c', this.str(utc), out);
    this.checkFailed();
    const et = this.readDouble(out);
    this.mod._free(out);
    return et;
  }

  utc2et(utc: string): number {
    const out = this.mod._malloc(8);
    this.call('utc2et_c', this.str(utc), out);
    this.checkFailed();
    const et = this.readDouble(out);
    this.mod._free(out);
    return et;
  }

  et2utc(et: number, format: string, precision: number): string {
    const len = 64;
    const out = this.mod._malloc(len);
    this.call('et2utc_c', et, this.str(format), precision, len, out);
    this.checkFailed();
    return this.mod.UTF8ToString(out);
  }

  spkpos(
    target: string,
    et: number,
    frame: string,
    abcorr: AberrationCorrection,
    observer: string,
  ): PositionResult {
    const pos = this.mod._malloc(3 * 8);
    const lt = this.mod._malloc(8);
    this.call(
      'spkpos_c',
      this.str(target),
      et,
      this.str(frame),
      this.str(abcorr),
      this.str(observer),
      pos,
      lt,
    );
    this.checkFailed();
    const result: PositionResult = {
      position: {
        x: this.readDouble(pos),
        y: this.readDouble(pos + 8),
        z: this.readDouble(pos + 16),
      },
      lightTime: this.readDouble(lt),
    };
    this.mod._free(pos);
    this.mod._free(lt);
    return result;
  }

  spkezr(
    target: string,
    et: number,
    frame: string,
    abcorr: AberrationCorrection,
    observer: string,
  ): StateVector {
    const state = this.mod._malloc(6 * 8);
    const lt = this.mod._malloc(8);
    this.call(
      'spkezr_c',
      this.str(target),
      et,
      this.str(frame),
      this.str(abcorr),
      this.str(observer),
      state,
      lt,
    );
    this.checkFailed();
    const result: StateVector = {
      position: {
        x: this.readDouble(state),
        y: this.readDouble(state + 8),
        z: this.readDouble(state + 16),
      },
      velocity: {
        x: this.readDouble(state + 24),
        y: this.readDouble(state + 32),
        z: this.readDouble(state + 40),
      },
      lightTime: this.readDouble(lt),
    };
    this.mod._free(state);
    this.mod._free(lt);
    return result;
  }
}
