---
description: Launch the fully autonomous full-spec run (goal, workflow verification, deviation report)
---

You are launching the fully autonomous Bessel build.

Steps:
1. Confirm prerequisites: run `git status` (must be clean), `node --version`
   (expect v22), and `pnpm --version` (expect 9+). If the tree is not clean,
   stop and tell me to commit first.
2. Run scripts/check-mac-setup.sh if present and report its output. If
   `xcodebuild -version` fails (no full Xcode), you will remove
   `pnpm cap:sync &&` from the verified-by clause and the iOS sync work from
   scope (web and desktop only this run), and you must say so in your plan.
   Android is deferred from all gates regardless.
3. Read docs/goals/AUTONOMOUS-FULL-RUN.goal.md, SPEC.md, and CLAUDE.md.
4. Issue the text in the "Goal body" code block of that file verbatim as a
   /goal (with the cap:sync adjustment from step 2 if needed), so the
   independent completion checker runs the listed commands after each turn.
5. Print your plan before execution begins.

This is Step 1 (build and self-verify). After it completes and commits, run
the independent verification workflow with /verify-spec (needs Claude Code
v2.1.154+).

Non-negotiables from CLAUDE.md apply for the entire run: no test deletion or
skipping, no weakened typecheck or budgets, no edits to docs/adr/, CLAUDE.md,
AGENTS.md, SPEC.md, the goal files, .size-limit.json, or lighthouserc.json, no
secrets or bulk kernels committed, and no em dashes anywhere.
