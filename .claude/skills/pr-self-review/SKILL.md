---
name: pr-self-review
description: Use before opening or merging a pull request — "before opening a PR", "gh pr create", "self-review", "review my changes", "перевір зміни перед PR" — to review the branch diff against the repo's skills (onion-architecture, security, react, zod, ...), run typecheck/tests for touched packages, and record a verdict that the PreToolUse gate hook requires before `gh pr create` or `gh pr merge`.
---

# PR Self-Review

Reviews the current branch against its base, routes each changed file to the matching repo skills, runs deterministic checks, and writes a **verdict** that the gate hook (`scripts/gate.mjs`, registered in `.claude/settings.json`) checks. Only **critical** findings block. [severity.md](severity.md) is the scale, [reviewer-prompt.md](reviewer-prompt.md) holds the subagent prompts, [README.md](README.md) has design notes and insights.

All scripts are plain Node >= 22 `.mjs` with no dependencies. Run them from the repo root: `node .claude/skills/pr-self-review/scripts/<name>.mjs`. Below, `S=.claude/skills/pr-self-review/scripts`.

## Modes

| | `--quick` | `--full` |
|---|---|---|
| Default when | you run this skill because of a `gh pr create`/`gh pr merge` | the user types `/pr-self-review` |
| checks + rules | yes | yes |
| Reviewers | only skills with a non-null `quickFocus` in `routing.json`; prompt: critical candidates only | every routed skill, all severities |
| Reviewer model | `sonnet` | `sonnet` |
| Critical verifier | `opus` | `opus` |

Both modes produce a verdict the hook accepts. `--fresh` ignores all caches (pass `--fresh` to `checks.mjs` and `cache.mjs get`). Record `mode` in the verdict.

## Precedence

Package rules win: `<pkg>/AGENTS.md` and `<pkg>/INSIGHTS.md` override a skill. Review **only added or changed lines**; pre-existing deviations (e.g. onion "Known deviations") do not count unless the change makes them worse.

## Workflow

1. **Collect.** `node $S/collect.mjs --base origin/main` (add `--no-fetch` offline). It prints JSON: `base`, `mergeBase`, `key` (`<merge-base>:<working-tree sha>`), `files`, `packages`, `routes` (`{skill: [files]}`), `signals` (hints for specific skills), `ruleFindings` (deterministic repo rules, already in finding shape), `uncovered`, `skillDrift`, `warnings`. Keep `key` for step 9. If `files` is empty, write a `pass` verdict (step 9) and stop.
2. **Checks.** Start `node $S/checks.mjs --base origin/main` in the background (JSON on stdout, exit 0 only on pass; `--packages a,b` to override, `--fresh` to skip its cache). It typechecks/tests touched packages plus dependents (`reviewer-core` also checks `server`) and returns `status: pass|fail|error`, `results`, `findings` (critical, `skill: "checks"`) and `recommendations` (e.g. run `*.it.test.ts`). `error` means a package has no `node_modules`; tell the user to install, do not treat it as pass. Step 4 runs in parallel with it.
3. **Plan.** Show the user a table: skill → files (cached / new), `uncovered`, `skillDrift`, the mode. Warn on `skillDrift` (a skill in `.claude/skills` missing from `routing.json`).
4. **Review.**
   - Per skill and file, look up the cache: `node $S/cache.mjs get findings --skill S --mode M --path P --base-blob <git rev-parse MERGEBASE:P> --new-blob <git hash-object P>` -> `{hit, value}`. Omit `--base-blob` for an added file and `--new-blob` for a deleted one (treated as `none`). The key includes the skill's content hash, so editing a skill or these docs invalidates it.
   - Files without a hit go to subagents: one per skill (`Agent`, general-purpose, `model: "sonnet"`), all in one message. Split a group over ~25 files or ~1500 diff lines. Build each prompt from [reviewer-prompt.md](reviewer-prompt.md) (quick or full template), passing the skill's files, its `signals`, and the base.
   - Each reviewer returns a JSON array of findings (schema in reviewer-prompt.md). Store per file: `echo '<json array>' | node $S/cache.mjs put findings --skill S --mode M --path P --base-blob B --new-blob N`.
5. **Normalize and dedupe.** Merge reviewer findings, `ruleFindings`, and checks `findings`. Re-map `severity` with [severity.md](severity.md) while keeping `skillSeverity`. Merge findings with the same `file:line` and substance into one, listing all skills.
6. **Verify critical.** For each critical with `needsVerification` not `false` (LLM and regex findings: secrets, skill findings) that has no cache entry (`cache.mjs get verify --id <stable id, e.g. rule@file:line>`), spawn an `opus` verifier (template in reviewer-prompt.md) to try to refute it. Refuted -> demote to `high` with a note. Store with `cache.mjs put verify --id ID` (JSON on stdin). `checks` findings and `do-not-touch-env` are never verified.
7. **Report.** Order: critical (`file:line`, rule, fix), high, medium, low, recommendations, uncovered, drift. Optionally save to `<git rev-parse --git-common-dir>/pr-self-review/reports/<key with : replaced by ->.md`.
8. **Decide on each critical.** `AskUserQuestion`: fix now / waive with a reason / leave blocked. If anything was fixed, return to step 1 (the cache re-reviews only changed files).
9. **Verdict.** Pipe JSON to `echo '<json>' | node $S/verdict.mjs write --key <key from step 1> --base origin/main`. It recomputes the key and refuses to write if the code changed since step 1 (exit 1, `{ok:false, expected, actual}`): then restart at step 1. Fields: `status` (`pass` iff no unwaived critical and checks passed, else `blocked`), `mode`, `base`, `skillsRun`, `checks`, `counts`, `criticals[]`, `waivers[{finding, reason}]`; `key`, `mergeBase`, `createdAt` are filled in. `node $S/verdict.mjs read --key K` prints a stored verdict.
10. **Waivers.** If any, emit a ready "Self-review waivers" section (finding, reason) for the PR body.

## The gate

`gate.mjs` blocks `gh pr create` and `gh pr merge` (at command position, also inside `sh -c`/`eval`/`xargs`/`$(`) unless a `pass` verdict exists for the key `<merge-base>:<HEAD^{tree}>`. For `create` the base is `--base`/`-B` else `main`; for `merge` the commit comes from `gh pr view`. Any new commit or uncommitted-then-committed change makes the key differ, so re-run the skill after the last commit. Commit first: the verdict is keyed to the working tree, and the gate sees only HEAD. There is no bypass; do not edit the hook to get past it.

## Do not

- Do not edit vendored skills or `skills-lock.json` to make a finding go away.
- Do not mark `pass` with an unwaived critical, or while `checks` is `fail`/`error`.
- Do not review untouched lines or files outside the diff.
