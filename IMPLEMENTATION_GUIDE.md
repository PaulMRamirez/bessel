# Bessel Implementation Guide

Status: Draft v1.0
Date: 2026-06-07
Audience: the engineer (you) driving the build with Claude Code.

This guide turns SPEC.md into action. It assumes you will use Claude Code's
`/goal` workflow to execute each phase as a checker-gated autonomous run, with a
clean Git checkpoint between phases.

---

## 0. Prerequisites

1. Claude Code v2.1.139 or later for `/goal` and its completion checker; v2.1.154
   or later for dynamic workflows (the /verify-spec verification step). Updating
   to the latest covers both.
   ```
   claude --version          # expect 2.1.154 or higher (covers /goal and workflows)
   npm update -g @anthropic-ai/claude-code
   ```
2. Node.js 22 LTS and pnpm 9+.
   ```
   node --version            # expect v22.x
   corepack enable && corepack prepare pnpm@latest --activate
   ```
3. A clean Git state at every phase boundary. `/goal` modifies many files
   autonomously; a clean tree is your only reliable rollback.
   ```
   git status                # expect: working tree clean
   ```
4. The official `/goal` reference, for when behavior surprises you:
   https://code.claude.com/docs/en/goal

macOS specifics (the primary platform): run `bash scripts/check-mac-setup.sh`
and resolve any FAIL lines; it also prints the exact remediation commands.
The required set is the Command Line Tools (`xcode-select --install`), Node 22
(nvm or `brew install node@22`), pnpm via corepack, and Claude Code 2.1.139+
(`npm install -g @anthropic-ai/claude-code`). Full Xcode plus CocoaPods is
optional and only gates iOS sync: without it the autonomous run proceeds web
plus desktop (the /implement command detects this and drops cap:sync from the
condition, saying so in its plan). Android is deferred from all gates; cap:sync
is iOS only. Optional de-risking: `brew install emscripten` in case the
CSPICE-WASM must be built from source, and `brew install tmux` for the long
session.

---

## 1. The shape of the workflow

The whole build is a pipeline of autonomous, verifiable runs:

```
scaffold  ->  /goal Phase 0  ->  review + commit
          ->  /goal Phase 1  ->  review + commit
          ->  /goal Phase 2  ->  review + commit
          ->  /goal Phase 3  ->  review + commit
          ->  /goal Phase 4  ->  review + commit
          ->  /goal Phase 5  ->  review + commit (production GA)
```

Each `/goal` run is bounded by a verifiable completion condition (from SPEC.md
Section 9), an explicit scope, and a turn limit. The completion checker, an
independent fast model, runs your `pnpm` commands after every turn and decides
whether the phase is done. You review the diff before committing, every time.

Do not run the whole thing as one giant goal. Long single goals drift, are hard
to audit, and burn tokens. One phase per goal, reviewed and committed, is the
unit.

---

## 2. Bootstrap the repository

Before any `/goal` run, get the skeleton in place so the agent has structure to
fill rather than invent.

1. Create the repo and drop this document set into it:
   ```
   mkdir bessel && cd bessel && git init
   # copy VISION.md, SPEC.md, this guide, GAP_ANALYSIS.md, REFERENCES.md,
   # AGENTS.md, CLAUDE.md, .claudeignore, docs/, and .claude/ into place
   git add . && git commit -m "docs: Bessel spec, vision, goals, ADRs, agent context"
   ```
2. Initialize the workspace and the verifiable command catalog. You can do this
   by hand, or make it the first small goal (Section 4, the scaffold goal). The
   commands in SPEC.md Section 8 must all exist and be runnable, even if they
   pass trivially at first, before Phase 0 starts. The checker can only verify
   conditions it can run.
3. Start Claude Code in the repo:
   ```
   claude
   ```
   Do not run `/init`. Claude Code reads CLAUDE.md automatically at session
   start, and this repo already ships a canonical, hand-authored CLAUDE.md (the
   command catalog, the dependency rule, the guardrails). `/init` is for repos
   that lack one; here it would scan a tree that has no source yet and could
   dilute your CLAUDE.md with thinner inferred content, and editing CLAUDE.md by
   hand right before a run is exactly what the guardrails forbid. So your
   conventions are already in session from the first turn, no command needed.
4. Establish the baseline. Run the catalog commands once and note the numbers:
   ```
   pnpm typecheck ; pnpm test ; pnpm lint ; pnpm build:web
   ```
   Knowing the starting state (even a failing one) is what lets the checker judge
   progress.

---

## 3. Anatomy of a phase goal

Each file in docs/goals/ is written in the `/goal` template:

```
/goal [task] until [verifiable finish line],
  verified by [the exact pnpm commands],
  while [scope boundaries: what to touch, what not to touch],
  or stop after [turn limit] and report remaining work.
```

The five elements, and why each matters:

- Task: what to build, pulled from the phase in SPEC.md Section 9.
- Finish line: the runnable condition from the SPEC's acceptance criteria.
- Verification: the specific `pnpm` commands the checker will run. If it is not
  a command, the checker cannot test it, so the SPEC's criteria are written as
  commands on purpose.
- Boundaries: which packages and apps are in scope this phase, and an explicit
  "do not" list (do not delete or skip tests to pass, do not edit ADRs,
  CLAUDE.md, or AGENTS.md, do not vendor secrets, do not weaken type checks).
- Turn limit: a safety net against an impossible condition looping forever.

You do not retype these. You open the goal file, copy its body, and paste it
after `/goal`, or use the `/phase` custom command (Section 6) which wraps this.

---

## 4. Optional scaffold goal (run first)

If you would rather not hand-build the workspace, make it the first goal. Keep it
narrow and verifiable:

```
/goal Create the pnpm workspace described in SPEC.md Section 4 and the
verifiable command catalog in SPEC.md Section 8. Create empty but typed packages
(@bessel/spice, catalog, scene, timeline, state, color, pal, ui) and app
shells (apps/web with vite-plugin-pwa, apps/desktop with electron-vite,
apps/mobile with Capacitor config). Wire root scripts: typecheck, lint, test,
build:web, build:desktop, cap:sync, e2e, verify.

Goal is complete when:
- pnpm install succeeds
- pnpm typecheck exits 0
- pnpm lint exits 0
- pnpm test exits 0 (a single placeholder test is acceptable)
- pnpm build:web succeeds and dist contains manifest.webmanifest and a service worker

Scope: create new files only. Do not implement SPICE, rendering, or catalog
logic yet. Do not edit docs/, ADRs, CLAUDE.md, or AGENTS.md. Stop after 25 turns
and report remaining work.
```

Review the diff, run `pnpm verify` yourself, commit:
```
git add . && git commit -m "chore: workspace scaffold and command catalog"
```

---

## 5. Running the phases

For each phase, in order:

1. Confirm a clean tree: `git status`.
2. Optionally prime context for the agent (one short message before the goal),
   for example pointing at the relevant SPEC section and any new fixtures.
3. Issue the goal. Either paste the body of docs/goals/PHASE-N-*.goal.md after
   `/goal`, or run `/phase N`.
4. Review the plan Claude prints before execution. This is the cheapest place to
   redirect. If the plan misreads the scope, correct it now.
5. Let the loop run. Claude edits, runs `pnpm` commands, reads failures, and
   fixes them. The checker fires silently after each turn.
6. Answer checkpoints crisply when Claude pauses for a genuine decision.
7. On completion, the goal clears itself and prints a summary.
8. Review and commit:
   ```
   git diff --name-only       # any unexpected files?
   git diff                   # any deleted tests, skipped checks, weakened types?
   pnpm verify                # verify independently, do not trust the summary alone
   git add . && git commit -m "feat(phase-N): <summary>"
   ```

Phase order and intent:

- Phase 0: PWA-only proof of concept. The Cassini-at-Saturn spine.
- Phase 1: core visualization across all three targets.
- Phase 2: operations features (shareable URLs, readouts, MMGIS deep links, CZML).
- Phase 3: desktop depth and advanced rendering.
- Phase 4: real-time, collaboration, and plugin GA.
- Phase 5: production hardening, release pipeline, suite contract tests, GA.

Chaining within a phase: if a phase is large, split it into two sequential goals
(for example, Phase 1a parser plus FOV, Phase 1b footprints plus shells),
committing between them. The goal files note natural split points.

---

## 6. The custom slash commands

Two commands live in .claude/commands/ to reduce friction:

- `/phase N` reads docs/goals/PHASE-N-*.goal.md and issues it as a `/goal` with
  the standard guardrails already attached. Use this instead of pasting.
- `/verify` runs the full gate (`pnpm verify`) and reports the result, so you can
  check state mid-session without leaving Claude Code.

Both are thin wrappers; the source of truth remains SPEC.md and the goal files.

---

## 7. Guardrails that keep autonomous runs honest

These are enforced in CLAUDE.md and restated in every goal's "do not" list. They
exist because a checker verifies the letter of a condition, not the spirit.

- Never delete, skip, or comment out a test to satisfy a condition. Test count
  must not drop below the phase baseline.
- Never weaken type checking (no blanket any, no ts-ignore to pass typecheck)
  except with an inline comment justifying a genuine external-types gap.
- Never disable lint rules to pass; fix the cause.
- Never modify docs/adr/, CLAUDE.md, AGENTS.md, or this guide during a feature
  goal. Decisions change through a deliberate edit, not a side effect.
- Never commit secrets or kernels-as-data; .claudeignore lists the exclusions.
- The core never imports a concrete PAL implementation. If a goal tempts the
  agent to break the dependency rule, that is a signal the scope is wrong.

After every goal, the review checklist:
```
git diff --name-only                          # scope respected?
grep -rn "ts-ignore\|eslint-disable" packages apps   # new suppressions?
grep -rn "it.skip\|test.skip\|xit(" packages apps    # skipped tests?
pnpm verify                                   # gate green?
```

---

## 8. Kernels and fixtures

The SPICE engine needs kernels, and the tests need deterministic fixtures.

- Keep a small, redistributable fixture set under kernels/ (an LSK, a planetary
  SPK such as de440s for a bounded interval, a frames kernel, and one mission
  SPK or CK sufficient for the Cassini-at-Saturn demo). Large or non-redistributable
  kernels are git-ignored and fetched by a script.
- The @bessel/spice fixture test asserts a `spkpos` value against a NAIF
  reference, which is what gives Phase 0 an objective finish line.
- For the web target's kernel hosting, see ADR-0005. During development the
  companion proxy can be a tiny local static server with range support; the OPFS
  cache is exercised by the Phase 2 offline e2e test.

---

## 9. When a goal misbehaves

- Loops without clearing: the condition may be impossible in scope. Press Ctrl+C,
  run the verification commands yourself, find the real blocker, then reissue a
  refined goal. Always keep the turn limit in the goal text.
- Clears too early: the condition was too narrow and the agent satisfied the
  letter (for example, by deleting a failing test). Add a guard to the condition
  ("test count must not decrease from baseline of N") and tighten the "do not"
  list. Restore with `git checkout`.
- Goes out of scope: a missing or loose boundary. `git checkout` the stray files
  and add explicit "only modify" and "do not touch" clauses next time.
- Burns more tokens than expected: the phase is too big. Split it and commit
  between sub-goals.

---

## 10. Fully autonomous run (single prompt)

The phase pipeline above is the reviewed-checkpoint path. The alternative is
one autonomous run following the Anthropic guidance pattern: set a goal to
implement the spec fully, then use a workflow to verify each part of the plan,
and prepare a report on what was implemented and if anything differed.

1. Use a model suited to long autonomous runs (Claude Opus 4.8):
   `claude --model claude-opus-4-8`, or `/model` in session.
2. Permissions: this repo's .claude/settings.json already sets auto mode
   (defaultMode acceptEdits) and pre-allows the build command vocabulary
   (pnpm, git, node, the WASM toolchain, Xcode and CocoaPods, curl to NAIF and
   npm), with secrets denied. Edits and listed commands auto-approve; a
   genuinely novel command pauses for approval, a tripwire rather than a wall.
   If a needed command stalls the run, add it to the allow list and continue.
   Fallback for containers or headless runs, where prompts cannot be answered:
   `claude --model claude-opus-4-8 --dangerously-skip-permissions`.
3. Run inside tmux or similar; the run is hours long. Start from a clean tree
   on a dedicated branch (`git checkout -b autonomous-run`). Start Claude Code
   with `claude --model claude-opus-4-8`; do not run `/init` (CLAUDE.md is
   already authored and loads automatically).
4. Issue `/implement`, or paste the Goal body from
   docs/goals/AUTONOMOUS-FULL-RUN.goal.md after `/goal`. This is Step 1: it
   builds every phase, commits per phase, and writes docs/reports/BUILD_REPORT.md.
5. Step 2, independent verification, is a separate dynamic workflow (the
   workflow model takes no mid-run input and ends in one report, so it does not
   nest inside the build goal). After Step 1 completes, run `/verify-spec`, or
   type `ultracode: verify the Bessel implementation against SPEC.md per
   docs/goals/VERIFY-WORKFLOW.md`. Workflow subagents run in acceptEdits and
   inherit your allowlist; shell commands outside it prompt mid-run (and fail
   under `claude -p`), so confirm the allowlist first. It fans out one agent per
   phase plus budget, security, and suite-contract agents, cross-checks their
   findings, and writes docs/reports/IMPLEMENTATION_REPORT.html.
6. Open IMPLEMENTATION_REPORT.html, then read `git log` and the diffs, then run
   `pnpm verify` yourself.
7. If Step 1 stops at the turn limit, it reports remaining work per phase;
   because each phase commits, reissue from the last green commit with a fresh
   /goal (or fall back to /phase N).

Watch and manage either run with `/workflows` (progress per phase, token use,
pause and resume). Resume works within the same session; exiting Claude Code
restarts a workflow fresh.

Headless equivalent for CI or a remote box: in headless mode prompts cannot be
answered, so anything outside the allow list fails instead of pausing; prefer
the bypass flag there, inside a container:
`claude -p "$(cat docs/goals/AUTONOMOUS-FULL-RUN.goal.md)" --model claude-opus-4-8 --dangerously-skip-permissions`
(strip the markdown wrapper so only the /goal line is sent; keep the turn
limit in the text).

## 11. Definition of done for the program

- All six phases (0 through 5) committed, each having passed `pnpm verify`
  independently, with CI green on main.
- The Cassini-at-Saturn demo loads and scrubs in the browser, on a phone (via
  the Capacitor build), and on the desktop (via the Electron build), from one
  source tree.
- A shared URL reconstructs a view exactly.
- A missing kernel produces an explicit error, never a silent re-center.
- Budgets green (`pnpm size`, `pnpm lhci`), audit clean (`pnpm audit:prod`), and
  the a11y scan reports zero serious or critical violations.
- Deep links to and from MMGIS work against the contract in
  docs/integrations.md.
- The repository is public, Apache-2.0, with a contribution guide, ready to live
  in the NASA-AMMOS organization (subject to the governance decision in SPEC.md
  Section 11).
