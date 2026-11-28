# server — Insights

## What Works

- Test fixtures that need a zip (skills import): build it in the test with `zipSync`/`strToU8` from `fflate` (see `test/skills-import-parser.test.ts`). A zip-bomb shape needs no fixture file: `zipSync({ 'big.bin': new Uint8Array(3_000_000) })` stays under 100 KB, and `fflate`'s `unzipSync(bytes, { filter })` hands you `originalSize`/`size` per entry **before anything is inflated** (the filter returning `false` selects nothing). That is how `modules/skills/import-parser.ts` enforces its size caps.

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

- Skills (`modules/skills/`, spec `specs/2026-11-28-skills.md`) feed the prompt from the SERVER, not from `reviewer-core`: `run-executor.ts` → `skillsRepo.resolvedForAgent(agent.id)` (enabled on `agent_skills` AND on `skills`, ordered by `agent_skills.order`) → `formatSkillBlock` → `reviewPullRequest({ skills })`. reviewer-core already had `skills?: string[]` and an un-fenced `## Skills / rules` section, so no engine change was needed. `run_skills` records name+version per run; the failure-path trace (`traceFromBuffer`) gets the blocks through the `skillBlocks` variable that is declared **outside** the `try` in `runOneAgent`.
- Skill version rule: only a change to `body` or `description` bumps `skills.version` and writes `skill_versions` (both go into the prompt). `name`/`type`/`enabled` do not. Restore appends a new version; it never rewrites history.
- `agent_skills` links are replaced as a whole through `PUT /agents/:id/skills` (`AgentsRepository.setSkillItems`, one transaction, array index = `order`). The service rejects any skill id outside the workspace with 404 and duplicates with 422. The older `POST /agents/:id/skills` had no workspace check (a foreign-workspace skill could be linked); it has one now.
- Skill import routes need `bodyLimit: IMPORT_BODY_LIMIT` (2 MB) per route: the app-wide `bodyLimit` is 1 MB and base64 inflates a 1 MB archive by a third. Transport is JSON (`content_base64`), no `@fastify/multipart`.
- `isUniqueViolation` (`modules/skills/helpers.ts`) checks both `err.code` and `err.cause.code`: drizzle 0.45 wraps driver errors, so a plain `err.code === '23505'` misses the duplicate-name case and you get a 500 instead of 409.

## Recurring Errors & Fixes

- `test/git-adapter-safety.test.ts` fails locally when your global git config signs commits with a passphrase-protected SSH key. The test runs a real `git commit`, which inherits `commit.gpgsign`. This is an environment problem, not a regression. The same signing setup blocks subagents from committing. With the user's OK, use `git -c commit.gpgsign=false commit …` and leave the git config alone.
- `test/git-adapter-safety.test.ts` can also fail for a different environment reason: a global git config `url.<…>.insteadOf` rewrite for `https://github.com` that embeds a personal access token. The test's `remote get-url origin` then returns the rewritten URL (with the token) instead of the clean one, and the assertion output prints that token. Not a regression; do not paste that output anywhere. Check with `git config --global --get-regexp '^url\.'` (it prints the token too, so don't echo it).
- `src/adapters/depgraph/index.ts` contains NUL bytes, so plain `grep -r` treats it as binary and silently skips it. An audit of "who imports `modules/`" then misses its `import … from '../../modules/repo-intel/constants.js'` (line 20). Use `grep -a` / `grep -rIa`, or `rg -a`, when auditing import boundaries.

## Session Notes

- 2026-11-22: Run Cost Badge (`feat/run-cost-badge`).
  - Restored `agent_runs.cost_usd` (migration `0010`) after `d45ab0d` removed it, and added `PrMeta.usage_total`.
  - Seed now inserts one `done` run for PR #482 (8213 in / 1302 out / $0.014), linked through `reviews.run_id`. The e2e flows 02 and 04 assert these values, so update them if you change the seed.
  - Known gap: spend from runs that fail after LLM calls is lost, because reviewer-core throws before returning usage.
- 2026-11-23: PR list FINDINGS column (`feat/findings-severity-filter`).
  - Added `PrMeta.findings_summary` (counts per severity + up to 5 preview findings), summed over each agent's latest review, dismissed excluded.
  - Integration test in `test/reviews.it.test.ts` inserts reviews/findings straight into the DB with explicit `createdAt`, which is faster and more deterministic than running the mock LLM twice.
  - `test/git-adapter-safety.test.ts` still fails locally because of commit signing (see Recurring Errors).
- 2026-11-28: Skills feature (`feat/skills`). New `modules/skills`, migration `0011` (`agent_skills.enabled`, `skill_versions.description/message`, `skills.updated_at` + unique `(workspace_id, name)`, new `run_skills`), `fflate` + `yaml` deps, demo skills in `db/seed-skills.ts`.
  - Seed adds six skills; three enabled on Security Reviewer (`3 of 6 enabled`, asserted by e2e flow 08). Seeded runs have no `run_skills`, so Stats are empty on a fresh DB until a real run happens.
  - `pnpm add` rewrites unrelated lines in `pnpm-lock.yaml` (`supports-color` peer suffixes, `libc:` fields) with pnpm 11. Expected noise, but review the lock diff before committing.
  - Don't run `pnpm install` in a git worktree whose `node_modules` is a symlink to the main checkout's: pnpm tries to remove the target (`ERR_PNPM_UNSAFE_MODULES_DIR` stopped it here). Copy `node_modules` with `cp -R` instead.
