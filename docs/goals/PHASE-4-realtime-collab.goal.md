# Phase 4: Real-time and collaboration

Maps to SPEC.md Section 9, Phase 4. Prerequisite: Phase 3 committed and green.
Start from a clean Git tree.

Intent: live operations and shared sessions, plus the mission plugin architecture
at general availability. WebSocket telemetry ingestion with Yamcs and OpenMCT
adapters, predicted-versus-actual ephemeris overlay, multi-user shared sessions,
WebXR, and a JUICE-style mission plugin registry.

## Goal body

```
/goal Implement Bessel Phase 4 as defined in SPEC.md Section 9.

Build:
1. Telemetry: a WebSocket ingestion layer with Yamcs and OpenMCT adapters, and a
   predicted-versus-actual ephemeris overlay in @bessel/scene.
2. Plugin architecture (general availability): a registry that discovers and lazily
   loads mission plugins from a declarative manifest (mission id, kernels, frames,
   catalog overlays, custom panels, color strategies). Plugins consume core APIs
   and the PAL interface only.
3. Collaboration: multi-user shared sessions (shared view state across clients).
4. WebXR: a VR walkthrough mode for the scene.

Goal is complete when ALL of the following exit 0 or hold:
- pnpm verify exits 0
- pnpm test includes a plugin-registry test that loads a fixture mission plugin and
  asserts its kernels, frames, and panels register, and that lazy loading is used
- pnpm test includes a telemetry-adapter test that drives a mock Yamcs WebSocket and
  asserts the predicted-versus-actual overlay updates
- pnpm e2e includes a test that connects to a mock telemetry source and confirms the
  overlay renders

Scope: a telemetry module, packages/scene (overlay), a plugin registry in core,
packages/color (strategy seam exposed to plugins), packages/ui (plugin panels,
session UI, XR entry), e2e.

Do not: change the public plugin manifest contract without an ADR. Do not delete or
skip tests. Do not weaken typecheck. Do not let plugins reach into platform
internals or break the dependency rule. Do not edit docs, ADRs, AGENTS.md, or
CLAUDE.md (except adding a new ADR if the manifest contract genuinely needs to
change, in which case stop and raise it). Do not use em dashes.

Stop after 40 turns and report remaining work if not complete.
```

## Natural split point

Phase 4a: the plugin registry and a fixture plugin plus its test. Phase 4b:
telemetry adapters and the overlay plus its tests. Collaboration and WebXR can be a
third goal. Commit between them.
