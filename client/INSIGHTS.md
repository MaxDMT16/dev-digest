# client — Insights

## What Doesn't Work

- Don't run pnpm here without checking the lockfile afterwards.
  - With pnpm 11.x installed locally, the `"pnpm": { "overrides": … }` block in `client/package.json` is ignored ("The "pnpm" field in package.json is no longer read by pnpm").
  - Any install then rewrites `pnpm-lock.yaml`: it drops the `postcss`/`katex` overrides, downgrades katex 0.18 → 0.16, and adds `libc:` fields. `../scripts/e2e.sh` and `dev.sh` run `pnpm install` too.
  - This was also seen after `pnpm typecheck && pnpm test`.
  - Workarounds:
    - Run checks through the local binaries: `./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/vitest run`.
    - Before committing, check that `git diff --stat -- pnpm-lock.yaml` is empty. Restore with `git checkout -- pnpm-lock.yaml`.

## Codebase Patterns

- All cost and token display goes through `src/lib/format-usage.ts`:
  - `formatUsd`: "—" for unknown, never "$0.00". Prints ≥3 decimals below $1 and 2 significant digits below $0.01.
  - `formatTokenCount`: "8.2K", promoting at 999.5 and 999_950.
  - `formatTokenTotal`: "9,119".
  - `formatUsdPrecise`: for tooltips.
- `src/components/run-cost-badge` (`RunCostBadge`, variants `compact`/`detailed`) is the one place that decides "—" versus a price. A non-`done` `status` or a `null` cost gives "—".
  - Don't re-implement that rule in pages. The RunHistory timeline only uses `formatUsd` directly because it already gates on `status === 'done'`.
- `RunCostBadge` reads the `runs` i18n namespace. The app loads every `messages/en/*.json`, but component tests don't. A test that renders the badge inside another component must pass both namespaces, e.g. `messages={{ prReview, runs }}`, or next-intl throws on missing keys.
- `VerdictBanner`'s `usage` prop has three states: omitted means no badge, `null` means "—", and a `RunSummary` means the detailed badge. `FindingsTab` feeds it from the already-fetched `prRuns` through a `run_id` map, so there is no extra request.

## Open Questions

- Should `pnpm.overrides` move from `client/package.json` to a `pnpm-workspace.yaml` (or wherever pnpm 11 reads it) so installs stop rewriting the lockfile? This needs a maintainer decision, since CI's pnpm version may differ.

## Session Notes

- 2026-11-22: Run Cost Badge.
  - Added a COST column to the PR list (`PrMeta.usage_total`: the sum of done runs, with a "≥" prefix when partial).
  - Added the detailed badge under the score ring in `VerdictBanner`, and a `{tokens} tok · {cost}` line in RunHistory rows.
  - Synced `RunSummary.cost_usd`, `RunStats.cost_usd` and `PrUsageTotal` into `src/vendor/shared`, identical to the server copy.
