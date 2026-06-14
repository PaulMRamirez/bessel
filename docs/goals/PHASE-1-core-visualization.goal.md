# Phase 1: Core visualization (all three targets)

Maps to SPEC.md Section 9, Phase 1. Prerequisite: Phase 0 committed and green.
Start from a clean Git tree.

Intent: feature-complete single-mission viewing, building and launching on all
three targets. Full catalog taxonomy, GLTF spacecraft, FOV cones, footprints,
frame axes, object browser, settings, Cosmographia keyboard shortcuts, and the
explicit missing-kernel error behavior.

## Goal body

```
/goal Implement Bessel Phase 1 as defined in SPEC.md Section 9.

Build:
1. @bessel/catalog: parse the full geometry taxonomy (Mesh, DSK, Globe, Rings,
   ParticleSystem, KeplerianSwarm, TimeSwitched) plus annotations. Validate
   against a JSON Schema and emit explicit, located, typed errors on bad
   references. A broken kernel reference must produce a typed error, never a
   silent camera re-center.
2. @bessel/spice: add getfov, pxform, sxform, sincpt, subpnt, bodvrd, bodvcd.
3. @bessel/scene: GLTF spacecraft nodes, sensor FOV cone meshes from getfov,
   observation footprints from sincpt, reference-frame axis triads, and direction
   vectors. Add the track-along-trajectory camera mode.
4. @bessel/ui: object browser panel, visualization settings panel, and keyboard
   shortcuts matching Cosmographia conventions.
5. PAL: complete pal-web; create pal-capacitor and pal-electron implementations
   sufficient to load fixture kernels on their platforms.
6. Shells: apps/desktop (electron-vite, main, preload exposing the typed IPC
   surface, renderer) and apps/mobile (Capacitor config, webDir apps/web/dist,
   iOS platform only; do not add the Android platform), both building and
   launching the shared UI.

Goal is complete when ALL of the following exit 0 or hold:
- pnpm verify exits 0 (typecheck, lint, test, build:web, size)
- pnpm build:desktop succeeds and produces a runnable Electron build
- pnpm cap:sync succeeds for ios (Android is deferred from the gates)
- pnpm test includes catalog tests covering all seven geometry types; a schema
  test asserting the Cassini-style example validates and that the two negative
  cases are rejected (a spacecraft with both arcs and trajectory; sideDivisions 1);
  AND a test asserting a broken kernel reference yields a typed, located error
- pnpm test includes a PAL KernelSource contract suite that pal-web and
  pal-electron both pass
- pnpm e2e includes tests for FOV cone rendering and footprint rendering on a
  fixture mission

Scope: core packages, all three PAL implementations, packages/ui, apps/web,
apps/desktop, apps/mobile, e2e, kernels (fixtures only).

Do not: implement URL state sharing, CZML, MMGIS deep links, telemetry, or the
plugin registry yet (those are Phase 2 and Phase 4). Do not delete or skip tests.
Do not weaken typecheck. Do not let any core package import a concrete PAL
implementation. Do not edit docs, ADRs, AGENTS.md, or CLAUDE.md. Do not use em
dashes.

Stop after 40 turns and report remaining work if not complete.
```

## Natural split point

Phase 1a: catalog taxonomy plus the spice additions plus FOV cones, with the
broken-reference error test. Phase 1b: footprints, the three PAL implementations,
and the desktop and mobile shells building. Commit between them.
