# e2e — Insights

## Recurring Errors & Fixes

- `../scripts/e2e.sh` boots the whole stack (Postgres, seed, API, web) and only then fails with `sh: tsx: command not found` if `e2e/node_modules` is missing. Before running it, set up:
  - `cd e2e && npm ci`, which leaves `package-lock.json` unchanged;
  - `npm i -g agent-browser && agent-browser install`, which is global and downloads a browser, so ask the user first.
- After `e2e.sh`, run `git status`. The script's `pnpm install` in `client/` can rewrite `client/pnpm-lock.yaml` (see client/INSIGHTS.md). Revert with `git checkout -- client/pnpm-lock.yaml`.
- `../scripts/e2e.sh` exits `125` right away with `Bind for 0.0.0.0:5433 failed: port is already allocated` when another container owns `:5433`. Don't kill it; override the ports: `E2E_PG_PORT=5441 E2E_API_PORT=3201 E2E_WEB_PORT=3200 E2E_PG_CONTAINER=devdigest-e2e-x ../scripts/e2e.sh`.

## Codebase Patterns

- Flows 02 and 04 assert seeded cost data: the PR list shows `$0.014`, and the VerdictBanner shows `8.2K→1.3K`. These come from the seeded `agent_runs` row in `server/src/db/seed.ts` (8213 / 1302 / 0.014). `RunCostBadge` renders both strings as contiguous text, so `wait --text` matches them. If the seed or the formatters change, update these steps.

- Flow 08 (`08-skills`) asserts seeded skills from `server/src/db/seed-skills.ts`: card names `pr-quality-rubric`, `secret-leakage-gate`, `lethal-trifecta`, and `3 of 6 enabled` on the Security Reviewer's Skills tab. Change the seed and this flow together. The agent Skills tab is opened with `find role button click --name Skills --exact`; `--exact` keeps it from matching other buttons whose accessible name merely contains "Skills".

## Session Notes

- 2026-11-22: Run Cost Badge. Added the cost assertions to flows 02 and 04. The hermetic run passes all 7 flows. GitHub-offline warnings and `CONNECTION_ENDED` errors during teardown are expected noise.
- 2026-11-28: Skills flow. Added `08-skills.flow.json` (passes). In this environment flows 04 and 05 FAIL at `open the PR row` (`find text "Add rate limiting…" click` right after `wait --url /pulls`), identically on a clean checkout of `HEAD` without the skills changes, so it is not caused by them. Flows 02 and 04/05 share that prefix, but only 02 has `wait --text "Add rate limiting…"` before the click; 04/05 look racy against the PR list render.

- 2026-11-28 (later): Fixed the 04/05 race above by adding `wait --text "Add rate limiting to public API endpoints"` before the row click, exactly like flow 02 (hermetic run: 8/8 flows pass). Resolves the first Open Question below: it was a render race, not an `agent-browser` version issue. Rule for new flows: after `wait --url`, always `wait --text` for the element before `find text … click`.

## Open Questions

- The 2026-11-22 note says all 7 flows passed in the hermetic run, but on 2026-11-28 04 and 05 fail on an unmodified `HEAD` (see above). Is that an `agent-browser` version difference or a render race that CI hides? Adding `wait --text "Add rate limiting to public API endpoints"` before the click in 04 and 05 would remove the race (not done: out of scope for the skills change).
