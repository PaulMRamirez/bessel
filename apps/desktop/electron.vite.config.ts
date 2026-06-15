import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// electron-vite project: main, preload, renderer. The preload exposes the typed
// IPC surface pal-electron consumes (Phase 1 fills it). The renderer reuses the
// shared React UI; in a later phase it loads apps/web/dist directly for parity.
export default defineConfig({
  main: {
    // Bundle the workspace packages (TS source) into main; only externalize real
    // node_modules so out/main is runnable without the monorepo source tree.
    plugins: [externalizeDepsPlugin({ exclude: ['@bessel/pal-electron', '@bessel/pal'] })],
    build: {
      outDir: 'out/main',
      lib: { entry: resolve(__dirname, 'electron/main.ts') },
    },
  },
  preload: {
    // Sandboxed preloads must be CommonJS, so emit preload.cjs.
    plugins: [externalizeDepsPlugin({ exclude: ['@bessel/pal-electron', '@bessel/pal'] })],
    build: {
      outDir: 'out/preload',
      lib: {
        entry: resolve(__dirname, 'electron/preload.ts'),
        formats: ['cjs'],
        fileName: () => 'preload.cjs',
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src'),
    plugins: [react()],
    worker: { format: 'es' },
    build: {
      target: 'es2022',
      outDir: 'out/renderer',
      rollupOptions: { input: resolve(__dirname, 'src/index.html') },
    },
  },
});
