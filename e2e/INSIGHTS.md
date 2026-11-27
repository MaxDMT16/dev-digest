# e2e — Insights

## Recurring Errors & Fixes

- `../scripts/e2e.sh` boots the whole stack (Postgres, seed, API, web) and only then fails with `sh: tsx: command not found` if `e2e/node_modules` is missing. Before running it, set up:
  - `cd e2e && npm ci`, which leaves `package-lock.json` unchanged;
  - `npm i -g agent-browser && agent-browser install`, which is global and downloads a browser, so ask the user first.
- After `e2e.sh`, run `git status`. The script's `pnpm install` in `client/` can rewrite `client/pnpm-lock.yaml` (see client/INSIGHTS.md). Revert with `git checkout -- client/pnpm-lock.yaml`.

## Codebase Patterns

- Flows 02 and 04 assert seeded cost data: the PR list shows `$0.014`, and the VerdictBanner shows `8.2K→1.3K`. These come from the seeded `agent_runs` row in `server/src/db/seed.ts` (8213 / 1302 / 0.014). `RunCostBadge` renders both strings as contiguous text, so `wait --text` matches them. If the seed or the formatters change, update these steps.

## Session Notes

- 2026-11-22: Run Cost Badge. Added the cost assertions to flows 02 and 04. The hermetic run passes all 7 flows. GitHub-offline warnings and `CONNECTION_ENDED` errors during teardown are expected noise.
