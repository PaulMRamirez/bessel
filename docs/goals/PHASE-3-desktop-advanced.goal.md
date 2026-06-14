# Phase 3: Desktop depth and advanced rendering

Maps to SPEC.md Section 9, Phase 3. Prerequisite: Phase 2 committed and green.
Start from a clean Git tree.

Intent: desktop parity with Cosmographia plus the rendering features that need
desktop, and mobile kernel import. Meta-kernel path resolution, a Python scripting
bridge (Electron only), DSK shape models, atmosphere and shadow and ring rendering,
star field, and Capacitor native filesystem kernel import.

## Goal body

```
/goal Implement Bessel Phase 3 as defined in SPEC.md Section 9.

Build:
1. pal-electron: full meta-kernel (.tm) path resolution, so a .tm with relative
   kernel paths resolves against the local tree and loads, matching desktop
   Cosmographia behavior. Add native open and save dialogs.
2. apps/desktop: a Python scripting bridge available only on Electron, surfaced
   through the Capabilities interface (present on Electron, absent on web and
   Capacitor).
3. @bessel/scene: DSK shape-model rendering; atmosphere shaders (Rayleigh and
   Mie); shadow mapping; ring rendering; star field from a catalog.
4. pal-capacitor: native filesystem kernel import (zip bundle) and
   iOS App Store ready packaging configuration (Android deferred).

Goal is complete when ALL of the following exit 0 or hold:
- pnpm verify exits 0 and pnpm build:desktop succeeds
- pnpm test includes a pal-electron meta-kernel resolution test (a .tm with
  relative paths resolves to loadable kernels in a fixture tree)
- pnpm test includes a Capabilities test asserting the Python bridge is reported
  present on Electron and absent on web and Capacitor
- pnpm e2e includes a Playwright Electron test that loads a meta-kernel and renders
  a DSK body

Scope: pal-electron, pal-capacitor, apps/desktop, apps/mobile, packages/scene,
packages/pal (Capabilities), e2e (Electron), kernels (DSK fixture).

Do not: implement telemetry or the plugin registry (Phase 4). Do not delete or
skip tests. Do not weaken typecheck. Do not edit docs, ADRs, AGENTS.md, or
CLAUDE.md. Do not use em dashes.

Stop after 40 turns and report remaining work if not complete.
```

## Natural split point

Phase 3a: pal-electron meta-kernel resolution plus the Python bridge and its
Capabilities test. Phase 3b: the advanced rendering set (DSK, atmosphere, shadows,
rings, star field) plus the Electron e2e test, and the Capacitor kernel import.
Commit between them.
