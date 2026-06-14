# Verification workflow: cross-check the implementation against the spec

This is Step 2 of the autonomous build (Step 1 is AUTONOMOUS-FULL-RUN.goal.md).
It is a Claude Code dynamic workflow: a script Claude writes that fans out
isolated subagents in the background and ends in one report. It follows the
quality pattern the workflows docs call out, independent agents adversarially
checking work before it is reported, rather than a single trusting pass.

Requirements: Claude Code v2.1.154 or later, workflows enabled (on Pro, the
Dynamic workflows row in /config). Run after the build goal has completed and
committed, on the same branch.

## How to launch

Any of these start it:

- `/verify-spec` (the saved command in .claude/workflows/, recommended)
- type: `ultracode: verify the Bessel implementation against SPEC.md following
  docs/goals/VERIFY-WORKFLOW.md`
- set `/effort ultracode`, then ask in plain words to verify the implementation
  against the spec

Before launching, make sure the agents' commands are on your allowlist
(.claude/settings.json already lists the pnpm, git, and node vocabulary), since
shell commands outside the allowlist prompt mid-run, and fail outright under
`claude -p`.

## What the workflow should do

Describe this to Claude when asking for the workflow, or rely on the saved
command which encodes it:

1. Fan out one verification agent per phase, 0 through 5. Each agent:
   - re-runs that phase's completion-condition commands from its
     docs/goals/PHASE-N file and records exit codes and key output,
   - audits the actual code against that phase's build list, item by item,
     looking for items claimed but missing, partially done, or stubbed,
   - checks the binding conventions in CLAUDE.md for its area (the dependency
     rule, loud failures, camera-relative rendering, no em dashes),
   - returns a structured finding: per item, one of implemented, partial,
     missing, or deviation, each with file and command evidence.
2. Add two cross-cutting agents:
   - a budgets-and-security agent: pnpm size, pnpm lhci, pnpm audit:prod, and a
     scan for secrets or bulk kernels committed,
   - a suite-contract agent: the MMGIS URL construction against
     docs/integrations.md and the inbound view URL round-trip.
3. Synthesize step: merge all findings, drop anything an agent could not
   substantiate with evidence, and write
   docs/reports/IMPLEMENTATION_REPORT.html, a single self-contained HTML file
   (inline CSS, no external requests, printable) with:
   - a summary table (phase by status),
   - what was implemented, per phase, with command evidence in tables,
   - what differed from SPEC.md, every deviation with rationale and code
     location,
   - open risks and recommended follow-ups.

## After it runs

Open docs/reports/IMPLEMENTATION_REPORT.html, then read git log and the diffs,
then run `pnpm verify` yourself. If the workflow did what you want, save it for
reuse from the /workflows view (press s); it is already provided as the
/verify-spec command so you can skip that.

## Note on scope

A dynamic workflow coordinates agents; it has no direct shell or filesystem
access of its own (the agents do the reading, writing, and running). It takes
no mid-run input, so this verification is a single pass that ends in the
report. If you want a fix-and-recheck loop, run this workflow, act on the
report, and run it again; agents that already passed return cached results
within the same session.
