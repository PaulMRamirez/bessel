---
description: Launch a Bessel phase as a /goal run with standard guardrails
argument-hint: <phase-number 0-4>
---

You are launching Bessel Phase $ARGUMENTS.

Steps:
1. Confirm prerequisites. Check that the working tree is clean (run `git status`)
   and note the current results of `pnpm typecheck`, `pnpm test`, and `pnpm lint`
   as the baseline. If the tree is not clean, stop and tell me to commit first.
2. Read the phase file docs/goals/PHASE-$ARGUMENTS-*.goal.md and the relevant
   phase in SPEC.md Section 9. Read CLAUDE.md for the binding conventions and the
   verifiable command catalog.
3. Take the text in the "Goal body" code block of that phase file and issue it
   verbatim as a `/goal`, so the independent completion checker runs the named
   `pnpm` commands after each turn. Keep the scope boundaries, the "do not" list,
   and the turn limit exactly as written.
4. Before execution begins, print your plan so I can redirect.

If issuing the goal from within this command does not activate the completion
checker in your version, print the exact "Goal body" text instead so I can paste
it after `/goal` myself, and tell me that is what happened.

Reminder of the non-negotiables from CLAUDE.md: do not delete or skip tests to
pass, do not weaken typecheck, do not edit docs or ADRs during a feature goal, do
not commit secrets or bulk kernels, and do not use em dashes anywhere.
