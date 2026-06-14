# docs/goals

Each file here is one phase from SPEC.md Section 9, written in the Claude Code
/goal template so it can be executed as a checker-gated autonomous run.

## How to use these

Two ways, both equivalent:

1. Open the phase file, copy everything under the "Goal body" heading, and paste
   it into Claude Code after typing `/goal `.
2. Run the custom command `/phase N` (see .claude/commands/phase.md), which reads
   the matching file and issues it as a /goal with the standard guardrails.

## Rules that apply to every phase

- Start from a clean Git tree. Commit between phases.
- Review the plan Claude prints before execution; redirect there if needed.
- After the goal clears: review git diff, run `pnpm verify` yourself, then commit.
- The completion conditions are written as runnable `pnpm` commands on purpose, so
  the independent completion checker can verify them objectively.
- The "do not" lists are deliberately strict; a checker verifies the letter of a
  condition, so the boundaries protect the spirit.

## Phase map

| File                              | SPEC phase | Targets                     |
| --------------------------------- | ---------- | --------------------------- |
| PHASE-0-poc.goal.md               | 0          | PWA only                    |
| PHASE-1-core-visualization.goal.md| 1          | web, Capacitor, Electron    |
| PHASE-2-operations.goal.md        | 2          | web (offline), integrations |
| PHASE-3-desktop-advanced.goal.md  | 3          | Electron depth, mobile FS   |
| PHASE-4-realtime-collab.goal.md   | 4          | all, plugin GA              |
| PHASE-5-production-ga.goal.md     | 5          | hardening, release, suite GA|

If a phase is large, split it into two sequential goals and commit between them.
Each file notes its natural split point.

For the autonomous build, run it in two steps: AUTONOMOUS-FULL-RUN.goal.md (or
/implement) builds and self-verifies every phase, then VERIFY-WORKFLOW.md (or
the /verify-spec dynamic workflow) independently cross-checks the result and
writes the HTML report. The per-phase files remain the reviewed-checkpoint path
and the resume mechanism. Dynamic workflows need Claude Code v2.1.154+.
