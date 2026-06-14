# Bessel

An open-source, SPICE-aware 3D mission visualization application, delivered from a
single codebase as a Progressive Web App, as native mobile apps (via Capacitor),
and as a desktop app (via Electron). It reads Cosmographia-compatible catalogs,
drives geometry from CSPICE compiled to WebAssembly, and renders with Three.js.

License: Apache-2.0 (LICENSE at the root). Status: specification and build
scaffold.

Program objective: a fully featured, production quality, efficient application
suitable for the NASA-AMMOS product suite alongside MMGIS. The
objective is enforced by verifiable gates (ADR-0009) and certified by Phase 5.

## What this repository currently contains

This is the planning and execution scaffold, written to be built with Claude
Code's `/goal` workflow. It is documentation and agent configuration, not yet the
implementation. The implementation is produced by running the phase goals.

## Where to start

1. VISION.md: why Bessel exists and what it is.
2. SPEC.md: the master specification, with verifiable per-phase acceptance criteria.
3. IMPLEMENTATION_GUIDE.md: how to drive the build with Claude Code and `/goal`.
4. GAP_ANALYSIS.md: what already exists and what Bessel must build.
5. REFERENCES.md: curated sources.

## Agent and build configuration

- CLAUDE.md: canonical agent context, the file Claude Code reads at session
  start (AGENTS.md is a thin pointer for other harnesses). The in-session
  operating manual: tech stack, the verifiable command catalog, the dependency
  rule, and the `/goal` session guardrails.
- docs/adr/: the binding architecture decisions.
- docs/goals/: one file per phase, each written as a pasteable `/goal`.
- .claude/commands/: `/phase N` to launch a phase, `/verify` to run the gate,
  `/implement` for the autonomous build.
- .claude/workflows/: `/verify-spec`, the dynamic workflow that cross-checks the
  build against SPEC.md and writes the HTML report (Claude Code v2.1.154+).
- .claudeignore: secrets and bulk kernel data the agent must not touch.
- .github/workflows/ci.yml: CI running the same gate vocabulary as /goal.
- .size-limit.json, lighthouserc.json: the efficiency budgets (hard gates).
- docs/integrations.md: the MMGIS deep-link contract, grounded in the MMGIS
  repository (scripts/fetch-mmgis-reference.sh keeps a local reference copy).
- CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md: governance.

## The build in one paragraph

Bootstrap the pnpm workspace and the verifiable command catalog (SPEC.md Section
8), start Claude Code in the repo (no `/init` needed; CLAUDE.md loads
automatically and is already authored), then run the phases in order (Phase 0
through
Phase 5) as `/goal` sessions, reviewing the diff and running `pnpm verify`
yourself before committing each one. The independent completion checker verifies
each phase by running the named `pnpm` commands, which is why the acceptance
criteria are written as commands.

## House rules

Do not use em dashes anywhere in this repository (code, comments, docs, commit
messages, UI copy). Use commas, colons, parentheses, or semicolons.
