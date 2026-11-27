# server — Insights

## What Doesn't Work

- Don't store `0` as a stand-in for unknown LLM cost. `agent_runs.cost_usd` uses `null` to mean "unknown". The client renders `null` as "—" and must never show "$0.00". Failed and cancelled runs write `costUsd: null` in `run-executor.ts` (`failAll`, the catch block, `traceFromBuffer`). A `0` there would quietly pull PR totals down.

## Codebase Patterns

- Per-run cost flows like this: reviewer-core `ReviewOutcome.costUsd` → `run-executor.ts` → `completeAgentRun({ costUsd })` → `agent_runs.cost_usd` → `GET /pulls/:id/runs` (`RunSummary.cost_usd`).
  - reviewer-core already sums OpenRouter's real `usage.cost` across retries and chunks. Never add a model call to compute cost.
- The PR list's `usage_total` is computed in `src/modules/pulls/usage-total.ts`, not in `routes.ts`.
  - One grouped query over `agent_runs` with `status = 'done'`, covering every run, not just the latest review. Pure mapping lives in `toPrUsageTotal`.
  - `runs_without_cost > 0` means the sum is partial, and the client prefixes it with "≥".
- The run log line `Usage: <in> in → <out> out · $<cost>` is what people reconcile against the OpenRouter dashboard. Format the cost with `formatCostPlain` (`src/modules/reviews/format-cost.ts`), not `${n}`: JS prints tiny numbers in exponent notation (`1e-7`).
- `RunStats.cost_usd` (trace jsonb) is `.nullish()` on purpose. Trace documents written before migration 0010 have no such key.
- The PR list's `findings_summary` is computed in `src/modules/pulls/findings-summary.ts` (not in `routes.ts`): the latest `kind='review'` row per (pr, agent) → their findings with `dismissed_at IS NULL`.
  - `agent_id = null` (seeded/legacy reviews) counts as one anonymous agent.
  - `null` means the PR has no review at all. A review with zero open findings gives a zero summary. The client shows "—" for both.
  - The two vendor copies of `contracts/platform.ts` are identical (client and server). Keep them identical when changing `PrMeta`.

## Recurring Errors & Fixes

- `test/git-adapter-safety.test.ts` fails locally when your global git config signs commits with a passphrase-protected SSH key. The test runs a real `git commit`, which inherits `commit.gpgsign`. This is an environment problem, not a regression. The same signing setup blocks subagents from committing. With the user's OK, use `git -c commit.gpgsign=false commit …` and leave the git config alone.

## Session Notes

- 2026-11-22: Run Cost Badge (`feat/run-cost-badge`).
  - Restored `agent_runs.cost_usd` (migration `0010`) after `d45ab0d` removed it, and added `PrMeta.usage_total`.
  - Seed now inserts one `done` run for PR #482 (8213 in / 1302 out / $0.014), linked through `reviews.run_id`. The e2e flows 02 and 04 assert these values, so update them if you change the seed.
  - Known gap: spend from runs that fail after LLM calls is lost, because reviewer-core throws before returning usage.
- 2026-11-23: PR list FINDINGS column (`feat/findings-severity-filter`).
  - Added `PrMeta.findings_summary` (counts per severity + up to 5 preview findings), summed over each agent's latest review, dismissed excluded.
  - Integration test in `test/reviews.it.test.ts` inserts reviews/findings straight into the DB with explicit `createdAt`, which is faster and more deterministic than running the mock LLM twice.
  - `test/git-adapter-safety.test.ts` still fails locally because of commit signing (see Recurring Errors).
