# DevDigest (starter)

Local-first AI pull-request review: import a PR from GitHub, run an agent review, get grounded structured findings.
This file is a map. Per-package rules live in `<package>/CLAUDE.md` and load automatically when you work in that folder — don't duplicate them here.

## Layout

**Not a workspace.** There is no root `package.json`: four standalone packages, each with its own deps and lockfile. Always `cd` into a package before running commands. Node ≥ 22; Docker for Postgres only.

| Dir | Package | What | Pkg mgr |
|-----|---------|------|---------|
| `server/` | `@devdigest/api` :3001 | Fastify 5 + Drizzle + Postgres/pgvector | pnpm |
| `client/` | `@devdigest/web` :3000 | Next.js 15 studio UI | pnpm |
| `reviewer-core/` | `@devdigest/reviewer-core` | Pure review engine (diff → prompt → LLM → findings) | npm |
| `e2e/` | `@devdigest/e2e` | Deterministic browser flows (no LLM) | npm |

Each package has the same doc set: `README.md`, `docs/`, `specs/`, `INSIGHTS.md` (`e2e/specs/` holds test flows).

## Commands

```sh
./scripts/dev.sh      # from zero: Postgres + install + migrate + seed + API + web (--no-seed --no-client --db-only)
./scripts/e2e.sh      # hermetic browser e2e on alternate ports; never touches the dev DB
```

Package-level run/test/typecheck commands are in each `<package>/CLAUDE.md`.

## Cross-package gotchas

- Code is shared via **tsconfig path aliases**, not published modules: `@devdigest/reviewer-core` → `../reviewer-core/src`; `@devdigest/shared` → `<pkg>/src/vendor/shared`; `@devdigest/ui` → `client/src/vendor/ui`.
- A change in `reviewer-core/` also affects `server` (it type-checks against that source): run server typecheck + unit tests too.
- `server/src/vendor/shared` and `client/src/vendor/shared` are **separate copies that already differ**. When changing a shared Zod contract, edit the copy the package imports and check the other.
- CI is path-filtered per package (`.github/workflows/*.yml`); when adding a cross-package import, update the `paths:` filters.
- Conventional Commits (`feat(reviews): …`, `fix(dev): …`).

## Do not touch

- `.env`, `.env.local`, `server/.env`, `client/.env` — git-ignored secrets. Don't read or echo values; edit `.env.example` instead.
- `skills-lock.json`, `.claude/skills/*` — vendored skills; don't edit to fit a feature.
- Lock files and generated dirs: see each package's CLAUDE.md.
- `docker compose down -v` deletes the real dev DB volume (`devdigest_pgdata`). Never use it to "reset".

## Insights loop

- Before working in a package, read its `INSIGHTS.md` and treat it as high-confidence guidance unless told otherwise.
- When you finish a substantial task, run `/engineering-insights` to append lessons to the touched package's `INSIGHTS.md`. Do not skip this step.

## Read when

- understanding the overall architecture, review flow, or roadmap → [README.md](README.md)
- writing or fixing tests / CI → [TESTING.md](TESTING.md)
- editing the built-in reviewer prompts or choosing a model → [docs/agent-prompts/README.md](docs/agent-prompts/README.md)
- working inside a package → read its `CLAUDE.md`, then its `README.md`, `docs/`, `specs/`, `INSIGHTS.md` as that file directs
