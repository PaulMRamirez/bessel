import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The canonical build all targets consume (SPEC Section 7). vite-plugin-pwa
// supplies the Workbox service worker and the web manifest; apps/web/dist is
// what Capacitor wraps and the Electron renderer loads. The CSPICE WASM is large
// and lazy loaded, so it is excluded from precache to honour the 4 MB budget and
// the app-shell JS budget (.size-limit.json).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        // Precache the app shell and the CSPICE wasm (code). Kernels (data) are
        // not precached: they flow through the OPFS cache in pal-web so the PWA
        // operates offline against cached kernels (SPEC Phase 2).
        globPatterns: ['**/*.{js,css,html,svg,wasm}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: 'Bessel',
        short_name: 'Bessel',
        description: 'SPICE-aware 3D mission visualization',
        theme_color: '#0b0e14',
        background_color: '#0b0e14',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
