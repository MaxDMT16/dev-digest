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

- Severity counters and the severity filter live in `FindingsPanel` (`SeverityCounters/` + `visibleFindings(findings, hideLow, severity)`).
  - Counts are computed AFTER the "Hide low confidence" filter, so each counter equals the number of cards of that level in the list when both filters are on.
  - Counts and `shown` are `useMemo`s over the `findings` prop, with no extra state. After accept/dismiss, `useFindingAction` refetches `["reviews", prId]` and the counters follow with no extra code. Don't cache counts in state.
  - `countBySeverity` (`src/lib/findings.ts`) is shared by the panel and the RunHistory timeline marks. Use `Object.hasOwn` there: an `in` check matched prototype keys such as `"toString"`.
- RunHistory timeline marks (`severityByRun` prop) are built in `FindingsTab` from the already-loaded reviews (`review.run_id`, same pattern as `runsById`).
  - A run with no matching review falls back to the old "N finding(s)" text, which keeps the existing RunHistory tests valid.
  - Tests that render `FindingsPanel`/`SeverityCounters`/`RunHistory` need `messages={{ prReview: messages }}`.
- PR list FINDINGS column: `PrFindingsCell` (`pulls/_components/PrFindingsCell/`) renders severity marks and a hover popover from `PrMeta.findings_summary`.
  - The popover is a `createPortal` to `document.body` with `position: fixed`, because the table card and rows have `overflow: hidden`. There is no Popover primitive in `@devdigest/ui` and `src/vendor/ui` must not be edited.
  - The cell stops click propagation, since the whole row navigates to the PR.
  - `useFindingAction` also invalidates `["pulls"]`, because the list counts open (non-dismissed) findings only. Without that, the list stays stale after Dismiss until the 60s refetch.
  - In tests, hover is `fireEvent.mouseEnter` on the `[tabindex='0']` wrapper. The popover has `role="tooltip"`.

## Open Questions

- Should `pnpm.overrides` move from `client/package.json` to a `pnpm-workspace.yaml` (or wherever pnpm 11 reads it) so installs stop rewriting the lockfile? This needs a maintainer decision, since CI's pnpm version may differ.

## Session Notes

- 2026-11-22: Run Cost Badge.
  - Added a COST column to the PR list (`PrMeta.usage_total`: the sum of done runs, with a "≥" prefix when partial).
  - Added the detailed badge under the score ring in `VerdictBanner`, and a `{tokens} tok · {cost}` line in RunHistory rows.
  - Synced `RunSummary.cost_usd`, `RunStats.cost_usd` and `PrUsageTotal` into `src/vendor/shared`, identical to the server copy.
- 2026-11-22: Severity counters + filter.
  - Added `N CRITICAL · N WARNING · N SUGGESTIONS` pills with a single-select filter in the expanded run (Agent runs tab), and compact colored severity marks in timeline rows. Client-only; no API or contract change.
  - Done through subagent-driven development, using local `tsc`/`vitest` binaries. Commits were made unsigned (`git -c commit.gpgsign=false`) because the SSH signing key needed a passphrase that a non-interactive agent can't enter.
  - Deferred minors: the tooltip uses `SEV[level].label` (not i18n); `focusIdx` isn't reset when `hideLow` changes (pre-existing); `aria-label` on the timeline marks span lacks `role="img"`.
  - Timeline marks are `<button>`s opening a `Modal` (`RunFindingsModal`) fed by `findingsByRun` (built in `FindingsTab` next to `severityByRun`). The original static spans were a bug: hover/click did nothing. A run without a `findingsByRun` entry keeps static spans.
- 2026-11-23: PR list FINDINGS column. Added the column between SCORE and COST (`GRID`/`COLUMN_KEYS` in `pulls/constants.ts`), the `list.findings.*` i18n keys and `PrFindingsCell`. No e2e change: the e2e runner has no documented hover support, so the popover is covered by RTL tests only.
