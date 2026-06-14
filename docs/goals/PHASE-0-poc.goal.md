# Phase 0: Proof of concept (PWA only)

Maps to SPEC.md Section 9, Phase 0. Prerequisite: the workspace scaffold and the
verifiable command catalog (SPEC.md Section 8) exist and run. Start from a clean
Git tree.

Intent: prove the spine end to end in the browser. CSPICE-WASM in a Web Worker,
kernels via pal-web, inner solar system with textured planets, basic time
controls, orbit and center-on-body camera, one Cosmographia spacecraft catalog
parsed and its trajectory rendered. Demo target: Cassini at Saturn with working
time scrubbing, installable as a PWA. The native-schema reference instance at
packages/catalog/schema/examples/cassini-saturn.example.json describes this exact
Cassini-at-Saturn geometry and is the target the demo should reproduce.

## Goal body

```
/goal Implement Bessel Phase 0 as defined in SPEC.md Section 9.

Build, in apps/web and the core packages:
1. @bessel/spice: a typed, promise-based wrapper over the CSPICE-WASM build,
   running in a dedicated Web Worker. Implement kernel management (furnsh, unload,
   kclear), time conversions (str2et, et2utc, utc2et), and spkpos and spkezr.
   Kernel bytes must come through the @bessel/pal KernelSource, never read
   directly.
2. pal-web KernelSource: load LSK and planetary SPK fixtures from kernels/ (range
   request capable), with an OPFS cache stub acceptable at this phase.
3. @bessel/scene: render the inner solar system with textured planet globes
   using Three.js, with camera-relative rendering. Implement orbit and
   center-on-body camera modes.
4. @bessel/timeline: epoch entry, play, pause, and rate control, driving a
   clock the scene subscribes to.
5. @bessel/catalog: parse a single Cosmographia spacecraft catalog fixture and
   produce a trajectory the scene renders as a polyline.
6. apps/web: assemble the above into an installable PWA via vite-plugin-pwa.

Goal is complete when ALL of the following exit 0 or hold:
- pnpm typecheck exits 0
- pnpm lint exits 0
- pnpm test exits 0, including a @bessel/spice fixture test that asserts spkpos
  of a known body at a known epoch matches a NAIF reference value within tolerance
- pnpm build:web succeeds AND apps/web/dist contains manifest.webmanifest and a
  generated service worker
- pnpm e2e includes a test named "poc-cassini" that loads the fixture catalog,
  asserts the trajectory renders (a non-empty WebGL frame), and asserts that
  advancing the timeline changes the rendered frame

Scope: only create or edit files under packages/spice, packages/pal (web impl),
packages/scene, packages/timeline, packages/catalog, packages/ui (minimal
controls), apps/web, e2e, and kernels (small fixtures only).

Do not: implement FOV cones, footprints, the full geometry taxonomy, Capacitor,
or Electron yet. Do not delete or skip tests to pass. Do not weaken typecheck with
any or ts-ignore. Do not edit docs, ADRs, AGENTS.md, or CLAUDE.md. Do not commit
bulk kernel data. Do not use em dashes in any code, comment, or copy.

Stop after 35 turns and report remaining work if not complete.
```

## Natural split point

If needed: Phase 0a is items 1 to 4 (engine plus scene plus timeline, with a
hardcoded body to render and the spice fixture test). Phase 0b adds the catalog
parse and the poc-cassini e2e test. Commit between them.
