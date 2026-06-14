import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const pkg = (p: string) => fileURLToPath(new URL(`./packages/${p}/src/index.ts`, import.meta.url));

// Anchored aliases: only the bare package specifier is rewritten to its src entry.
// Subpath imports (for example @bessel/spice/wasm/cspice.mjs) fall through to node
// resolution via each package's exports map.
const aliasFor = (name: string, p: string) => ({ find: new RegExp(`^@bessel/${name}$`), replacement: pkg(p) });

export default defineConfig({
  resolve: {
    alias: [
      aliasFor('spice', 'spice'),
      aliasFor('catalog', 'catalog'),
      aliasFor('scene', 'scene'),
      aliasFor('timeline', 'timeline'),
      aliasFor('state', 'state'),
      aliasFor('color', 'color'),
      aliasFor('pal', 'pal'),
      aliasFor('pal-web', 'pal-web'),
      aliasFor('pal-capacitor', 'pal-capacitor'),
      aliasFor('pal-electron', 'pal-electron'),
      aliasFor('ui', 'ui'),
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', 'vendor/**', 'e2e/**'],
    benchmark: {
      include: ['packages/**/*.bench.ts'],
    },
  },
});
