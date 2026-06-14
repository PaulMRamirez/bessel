---
description: Run the Bessel verification gate and the post-goal review checks
---

Run the full verification gate and report results concisely.

1. Run `pnpm verify` (typecheck, lint, test, build:web, size in sequence).
   Report the pass or fail of each step, the test count, and the size-limit
   headroom.
2. Run these review checks and report anything they find:
   - `git diff --name-only` to show what changed since the last commit
   - `grep -rn "ts-ignore\|eslint-disable" packages apps` for new suppressions
   - `grep -rn "it.skip\|test.skip\|xit(\|describe.skip" packages apps` for skipped tests
   - confirm apps/web/dist contains manifest.webmanifest and a service worker if a
     web build was produced
3. If the phase being verified is 2 or later, also run `pnpm audit:prod` and
   `pnpm lhci` and report their results.
4. Summarize: is the gate green, did the test count drop from the phase baseline,
   and are there any out-of-scope file changes or new suppressions I should look
   at before committing.

Do not fix anything in this command; just verify and report.
