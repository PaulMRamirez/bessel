# Autonomous full run: implement the spec, then verify by workflow

This is the autonomous variant of the build, following the Anthropic guidance
pattern: set a goal to implement the spec fully, then use a workflow to verify
each part of the plan, and prepare a report on what was implemented and if
anything differed.

Two steps, because a Claude Code dynamic workflow is its own run that takes no
mid-run input and ends in one report (per the workflows docs); a long /goal and
a fan-out workflow do not nest cleanly. So:

  Step 1 (this file): a /goal that builds and self-verifies each phase, commits
  per phase, and writes a build-side report.
  Step 2 (VERIFY-WORKFLOW): a separate dynamic workflow, launched with the
  ultracode keyword or the saved /verify-spec command, that fans out one
  isolated agent per phase to adversarially re-check the build against SPEC.md
  and produce the HTML deviation report.

Intended for Claude Opus 4.8 in auto permission mode: .claude/settings.json sets
acceptEdits as the default and pre-allows the build command vocabulary, so the
run proceeds unattended and only a genuinely novel command pauses for approval
(see IMPLEMENTATION_GUIDE.md Section 10). The per-phase files in this directory
remain the fallback if you prefer reviewed checkpoints or need to resume after
an interruption: each phase commits on completion, so a fresh /goal can pick up
from the last green commit.

Prerequisites before issuing: clean Git tree; Node 22 and pnpm 9+; network
access for pnpm and NAIF kernel downloads. Android is deferred from all gates;
cap:sync is iOS only. If Xcode is not installed, delete "pnpm cap:sync &&"
from the verified-by clause below and the mobile sync items (web and desktop
only this run), and note it; everything else still runs. Run
scripts/check-mac-setup.sh first to confirm the environment.

## Goal body

```
/goal Implement Bessel fully per SPEC.md, then verify by workflow and report.

Plan of record: execute the scaffold goal in IMPLEMENTATION_GUIDE.md Section 4,
then Phases 0 through 5 in order, each per its docs/goals/PHASE-N-*.goal.md
build list and completion conditions, under the binding conventions in
CLAUDE.md. Commit after the scaffold and after each phase with conventional
commits (feat(phase-N): ...). Obtain SPICE kernels by writing and running
kernels/fetch.sh against the public NAIF archive (LSK, de440s bounded SPK,
frames kernel, and Cassini SPK/CK sufficient for the Phase 0 demo; bulk data
stays git-ignored). Obtain CSPICE-WASM from the arturania/cspice project
(npm or git dependency, or vendored build); if it cannot be obtained or built
in this environment, stop and report rather than stubbing the SPICE engine.

After Phase 5 conditions hold, write
docs/reports/BUILD_REPORT.md summarizing per phase what was implemented, the
commands run with their results, and any deviation from SPEC.md with its
rationale and location in the code. Commit it. The independent cross-checked
HTML report is produced by Step 2 (the verification workflow), not here.

Goal is complete when ALL of the following hold:
- pnpm verify exits 0
- pnpm build:desktop exits 0
- pnpm cap:sync exits 0
- pnpm e2e exits 0 (including the a11y scan and suite URL contract tests)
- pnpm audit:prod exits 0
- pnpm lhci exits 0
- pnpm release:dry exits 0
- test -s docs/reports/BUILD_REPORT.md exits 0
- git status --porcelain prints nothing (all work committed)

While: never delete, skip, or weaken a test to pass; never weaken typecheck or
lint; never edit docs/adr/, CLAUDE.md, AGENTS.md, SPEC.md, the goal files,
.size-limit.json, or lighthouserc.json; never commit secrets, certificates, or
bulk kernel data; keep the core free of concrete PAL imports; no em dashes
anywhere. If a completion condition is genuinely unsatisfiable in this
environment, stop and report the blocker instead of working around it.

Or stop after 500 turns and report remaining work, per phase, with the exact
failing commands.
```

## Notes

- The verified-by commands are the union of every phase gate plus the build
  report and a clean tree, so the checker certifies the whole program.
- Step 2 is the cross-checked verification: launch it after this goal completes
  with `/verify-spec`, or by typing `ultracode: verify the Bessel
  implementation against SPEC.md per docs/goals/VERIFY-WORKFLOW.md`. It needs
  Claude Code v2.1.154+.
- If the single mega-goal proves unwieldy, fall back to /phase 0 through
  /phase 5 with commits between; all three paths share every artifact.
