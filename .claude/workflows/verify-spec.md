---
description: Cross-check the Bessel implementation against SPEC.md with a fan-out verification workflow
---

ultracode

Run a dynamic workflow that verifies the Bessel implementation against SPEC.md,
following docs/goals/VERIFY-WORKFLOW.md. Do not trust the build session's
claims; agents re-run commands and read code.

Fan out one isolated agent per phase (0 through 5). Each agent re-runs that
phase's completion-condition commands from its docs/goals/PHASE-N file (record
exit codes and key output), audits the actual code against that phase's build
list item by item (implemented, partial, missing, or deviation, each with file
and command evidence), and checks the CLAUDE.md conventions for its area (the
dependency rule, loud failures, camera-relative rendering, no em dashes).

Add two cross-cutting agents: one running pnpm size, pnpm lhci, and
pnpm audit:prod plus a scan for committed secrets or bulk kernels; one checking
the MMGIS URL construction against docs/integrations.md and the inbound view
URL round-trip.

Synthesize: merge findings, drop anything not substantiated by evidence, and
write docs/reports/IMPLEMENTATION_REPORT.html as a single self-contained HTML
file (inline CSS, no external requests, printable) with a phase-by-status
summary table, a per-phase implemented section with command-evidence tables, a
deviations section (each with rationale and code location), and an open-risks
section. Do not use em dashes anywhere in the report.
