# pr-self-review - design notes

Companion to [SKILL.md](SKILL.md). The skill reviews the branch diff before a PR is opened or merged and records a verdict that a PreToolUse hook enforces.

## Layout

| File | Role |
|------|------|
| `SKILL.md` | The workflow Claude follows |
| `severity.md` | One severity scale and per-skill mapping |
| `reviewer-prompt.md` | Reviewer (quick/full) and verifier prompts, finding schema |
| `routing.json` | skill -> globs / content regex / `quickFocus`; `excluded`; `ignore`; `packages` |
| `checks.json` | typecheck/test commands per package, dependents, key deps, integration hint |
| `scripts/lib.mjs` | merge-base, keys (working tree / subtree / blob), storage, globs |
| `scripts/collect.mjs` | diff -> files -> routes, signals, rule findings, drift (JSON) |
| `scripts/rules.mjs` | deterministic AGENTS.md rules (called by collect) |
| `scripts/checks.mjs` | parallel typecheck/test per touched package, cached per package key |
| `scripts/cache.mjs` | findings and verifier cache; `prune` |
| `scripts/verdict.mjs` | verdict write (re-checks the key) and read |
| `scripts/gate.mjs` | the hook; registered in `.claude/settings.json` |

Tests: `node --test .claude/skills/pr-self-review/scripts` (no dependencies).

## Keys and storage

- Verdict key: `<merge-base>:<tree sha>`. The gate uses `HEAD^{tree}`; the skill computes the working-tree sha with a temporary index (the real index is untouched). After committing everything the two are equal.
- Findings cache key: skill + skill content hash (skill dir, `reviewer-prompt.md`, `severity.md`, its `routing.json` entry) + mode + path + base blob + new blob. Editing a skill invalidates its cache.
- Checks cache key: subtree sha of the package plus its key dependencies (`server` includes `reviewer-core`) plus a hash of the command list. Only passes are cached.
- Storage: `<git-common-dir>/pr-self-review/{findings,verify,verdicts,reports}`, pruned after 14 days.

## Adding or changing a skill

A skill folder in `.claude/skills` must appear in `routing.json` under `skills` or `excluded`. Otherwise `collect.mjs` reports it as `skillDrift`. Check with `node .claude/skills/pr-self-review/scripts/collect.mjs --no-fetch` and read `skillDrift`.

## Insights

- `path.matchesGlob` treats dot-directories specially (`.claude/x.md` does not match `**/*.md`); `lib.matchAny` also tries a dot-neutralised copy. Do not call `matchesGlob` directly.
- `gitTry` returns `""` (not `null`) for successful commands with no output; check `=== null` for failure.
- Shell-level matching of the gated command is a security boundary. A regex with nested quantifiers was exponentially slow on adversarial input; the gate uses a linear tokenizer. Keep the timing tests when changing it.
- The gate also blocks any command that mentions the gated phrase together with `$(`, backticks, `eval` or `xargs` while no verdict exists (heredoc commit messages, appended reports). Write such text with an editor tool and commit with a plain `git commit -m "..."`.
- A timed-out check must kill the whole process group (`detached` spawn, `kill(-pid)`), or grandchildren keep the pipes open and the runner hangs.
- `checks.mjs` reports `error` (not pass) when a package has no `node_modules`; the skill must never write a `pass` verdict in that case.
