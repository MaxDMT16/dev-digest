---
name: engineering-insights
description: Record concrete, non-obvious lessons in the INSIGHTS.md of the package that was touched (server, client, reviewer-core, e2e). Use at the end of a substantial task (wrap-up) and as you go whenever something unexpected happens - a gotcha, dead end, library quirk, or recurring error with its fix. Also use when the user runs /engineering-insights. Skip trivial config tweaks and anything obvious from reading the code.
---

# Engineering Insights

Append lessons to the `INSIGHTS.md` of **each package the task touched** (`server/`, `client/`, `reviewer-core/`, `e2e/`; `repo-intel` lives in `server/`). The next session in that package reads it, so write for a reader with zero context.

1. **Read first.** Open the package's `INSIGHTS.md` so you don't duplicate an entry. Never create the file for a package that doesn't have one.
2. **Append-only.** Add entries; never rewrite or delete existing ones. If a new lesson contradicts an old one, add it under `## Open Questions` naming both and tell the user.
3. **Fixed sections**, created only when needed, in this order: `## What Works` · `## What Doesn't Work` (dead ends and anti-patterns — the most valuable, never skip it) · `## Codebase Patterns` · `## Tool & Library Notes` · `## Recurring Errors & Fixes` · `## Session Notes` (dated `YYYY-MM-DD` summaries) · `## Open Questions`.
4. **Be specific, not banal.** An entry must be actionable cold: the next agent knows what to do without asking. Name files, commands, and the reason. Test: *if it would be obvious to anyone reading the code, don't write it.*
   - Bad: "Migrations can be tricky." / "Be careful with async."
   - Good: "`pnpm db:migrate` is not run on server boot — run it after pulling or after `pnpm db:generate`, or routes fail with missing-table errors."
5. **When.** At wrap-up of a session with a real problem, solution, or discovery (roughly >30 min of work), and immediately when something non-obvious happens. Signal quality over volume: no entry is better than a noisy one.
6. **Hygiene.** If a file passes ~200 entries, propose splitting it into domain files instead of letting it grow. Treat entries as a draft for review: finish by showing the user what you appended, and don't commit unless asked.
