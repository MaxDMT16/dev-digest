---
name: onion-architecture
description: Use when adding or changing backend code in server/ or reviewer-core/ — new route, service, repository, adapter, port, Drizzle query, external integration (GitHub, LLM, git) — or when reviewing backend code for layering, dependency direction, or where logic belongs.
---

# Onion Architecture (server + reviewer-core)

Dependency-direction rules for the DevDigest backend, laid over the **existing** file names (no renames). `[S#]` = source in [README.md](README.md); ❌ → ✅ pairs on real repo code in [examples.md](examples.md). API details live in the vendored skills [fastify-best-practices](../fastify-best-practices/SKILL.md), [drizzle-orm-patterns](../drizzle-orm-patterns/SKILL.md), [zod](../zod/SKILL.md), [typescript-expert](../typescript-expert/SKILL.md). This skill only decides *where* a line goes and *what it may import*.

## Precedence — read first

1. **Package rules win.** `server/AGENTS.md`, `reviewer-core/AGENTS.md` and their `INSIGHTS.md` override this skill. DI/adapter changes and shared contracts are spec-first (medium+ risk) there.
2. **Then the module's local convention** for names and file split: `routes.ts → service.ts → repository.ts` + `helpers.ts`, `constants.ts`.
3. **Then the rules below.** Where the local code itself breaks a rule (see *Known deviations*), the lines you add follow the rule, not the neighbours.
4. **Change only what the task needs.** Don't refactor other modules. In the module you touch, move only the code you are already changing toward the rule.

## The Dependency Rule

Source dependencies point **inward only** [S4][S11][S1]. An inner ring never names anything from an outer ring: no import, no type, no class name. The inner ring **declares an interface (port)**; an outer ring implements it; the composition root plugs it in [S1][S2][S6]. The core must compile and be tested without infrastructure [S3].

**Violating the letter is violating the spirit.** An `import type` of `db/schema`, a `Container` parameter "for now", a row type that "happens to match the DTO" — each one is a dependency on an outer ring.

## Rings → files in this repo

| Ring (inner → outer) | Files | May import |
|---|---|---|
| **Domain** | pure module files — `helpers.ts` counts **only while pure** (no row-type import) — `constants.ts`, `pulls/status.ts`, `reviews/format-cost.ts`; `@devdigest/shared` contracts (`z.infer` types); `reviewer-core/src` | shared contracts, `zod`, `platform/errors.ts`, other pure files |
| **Ports** | `server/src/vendor/shared/adapters.ts` (`LLMProvider`, `GitHubClient`, `GitClient`, `CodeIndex`, `AuthProvider`, `SecretsProvider`, `Embedder`); module ports such as `modules/repo-intel/types.ts` (`RepoIntel`); the store interface a service declares | domain only — signatures use domain types, never SDK or row types [S7] |
| **Application** | `service.ts`, `reviews/run-executor.ts`, `reviews/findings.ts` | domain, ports, `platform/errors.ts`, `platform/resilience.ts`, `@devdigest/reviewer-core` |
| **Infrastructure** | `repository.ts`, `reviews/repository/*.repo.ts`, `src/adapters/*`, `src/db/*`, `platform/jobs.ts` | inner rings + `drizzle-orm`, SDKs, `node:fs`; implements ports, maps rows/SDK payloads → domain types |
| **Presentation** | `routes.ts` handlers, `modules/_shared/{context,schemas}.ts` | services, shared contracts (for `schema:`), `getContext`, `platform/errors.ts` |
| **Composition root** | `app.ts`, `platform/container.ts`, `modules/index.ts`, and the **wiring block at the top of each module plugin** in `routes.ts` (runs once at registration) | everything; the only code that calls `new` on repositories/adapters and reads `Container` fields |

`platform/errors.ts` and `platform/resilience.ts` import nothing, so any server ring may use them.

## Forbidden imports — each one is a High finding

| Import | Allowed only in |
|---|---|
| `fastify`, `FastifyRequest`, `FastifyReply` | `routes.ts`, `modules/_shared/context.ts`, `app.ts` |
| `drizzle-orm`, `db/schema`, `db/rows`, `typeof t.x.$inferSelect` | repositories, `src/db/*`, `platform/jobs.ts` |
| SDKs: `octokit`, `openai`, `@anthropic-ai/sdk`, `simple-git`, `@ast-grep/napi` | `src/adapters/*` |
| `Container` (value or type) | composition root and wiring blocks; `getContext(container, req)` in handlers |
| concrete `src/adapters/*` classes or functions | composition root, tests |
| `modules/*` from `src/adapters/*` or `platform/*` | nowhere (`container.ts` is the composition root, so it is exempt) |
| another module's `service`, `repository` or `constants` | nowhere — use a `Container` getter (`agentsRepo`, `reviewRepo`, `repoIntel`) or a port [S7][S17] |
| I/O of any kind (DB, network, fs, `process.env`) in `reviewer-core` | nowhere; the only side effect is the injected `LLMProvider` |

## Practices by tool

**Fastify — presentation** [S15][S16][S17]
- One encapsulated plugin per module, registered in `modules/index.ts`. A handler is `getContext` → one service call → return. No business branching, no Drizzle, no `container.github()`.
- Schema-first: `{ schema: { params, body, querystring } }` with shared Zod contracts through `fastify-type-provider-zod`, not `X.parse(req.body)` in the handler.
- `FastifyRequest` and `reply` never enter a service; pass plain values (`workspaceId`, `req.body`). A logger goes in typed as the `Logger` type alias from `run-executor.ts`, as `reviews/routes.ts` does with `req.log`.
- Failures are thrown `AppError` / `NotFoundError` (`platform/errors.ts`), mapped by the error handler in `app.ts`. Success status codes (`201` vs `200`) are transport and stay in the route.

**Drizzle — infrastructure** [S9][S14][S20]
- Queries only in `repository.ts` (split into `repository/*.repo.ts` when large, as `reviews/` does).
- `$inferSelect` / `$inferInsert` and `db/rows.ts` types **stay inside the repository**. Its public methods take and return domain types: a shared contract type (`Repo`, `Agent`) or a module type. The row → domain mapper lives in the repository [S4]. `settings/helpers.ts` (declares its own `SettingsRow`, no schema import) is the shape to copy.
- Atomic multi-statement write = **one repository method** with `this.db.transaction(async (tx) => …)` [S20]. A use case spanning several repositories gets a `withTransaction` port (**proposal** — none exists yet) [S8]. `tx` and `Db` never pass through a service.

**Zod — boundaries** [S23][S24]
- Parse once at each edge, then trust the type: HTTP input (route `schema`), GitHub/LLM payloads (in the adapter; LLM structured output via `parseWithRepair`), env (`platform/config.ts`), JSON columns (`AgentVersionConfig.parse(row.configJson)`).
- Zod is fine in the domain: it is a pure library and the contracts are domain types. Don't re-validate parsed values inside the core.
- `vendor/shared` has two copies that already differ: `server/src/vendor/shared` (server **and** reviewer-core, via tsconfig path) and `client/src/vendor/shared`. Any port or contract change, including a response-only DTO: edit the copy the package imports, then check the other copy.

**DI and wiring** [S2][S3]
- A **new** service gets **narrow, explicit deps** through its constructor: `constructor(private deps: { repos: ReposStore; jobs: Pick<JobRunner, 'enqueue'>; git: GitClient })`. The whole `Container` is a **service locator** (hidden deps, `{ db } as unknown as Container` in tests). `Pick<Container, 'git' | 'jobs'>` is only a migration step for **existing** code, never the shape of new code.
- **Extending a service that already takes `Container`:** don't grow the locator — no new `this.container.x` reads. Give the new method its own narrow deps (an optional second constructor arg, e.g. `labels?: LabelsDeps`, set in the wiring block) or put it in a sibling class with narrow deps (examples §2b).
- A service never `new`s its repository or an adapter; it is never wired inside another service. The module's wiring block (top of `routes.ts`) does it (**proposal**, examples §2):
  ```ts
  const c = app.container; // wiring: the only Container reads in this module
  const service = new RepoService({ repos: new RepoRepository(c.db), jobs: c.jobs, git: c.git });
  ```
- Secret-backed ports (`c.github()`, `c.llm(id)`, `c.embedder()`) are async, may throw `ConfigError`, and are rebuilt after `invalidateSecretCaches()`. Inject a provider function (`github: () => c.github()`), don't resolve them at wiring time.
- The store interface a service needs is declared next to it (top of `service.ts` or the module's `types.ts`) in domain types; `repository.ts` satisfies it structurally. `import type { XRepository }` is tolerated only when its signatures carry no row types.
- No DI library: manual wiring is enough here [S3]. Alternatives in README.

**GitHub, LLM, git — through ports only** [S7][S12]
- New capability (e.g. labels) = port method in `adapters.ts` in domain terms + implementation in `src/adapters/<x>/` + fake in `src/adapters/mocks.ts`.
- Retry/timeout (`withRetry`, `withTimeout`) and SDK → domain mapping live in the adapter, as in `adapters/github/octokit.ts`. SDK types, SDK errors and tokens never leave `src/adapters/`; failures surface as `ExternalServiceError` [S9].
- Secrets only via `SecretsProvider`; never `process.env.GITHUB_TOKEN` in a module.

**reviewer-core** — the innermost ring. Imports only `@devdigest/shared` and `zod`, never `server/src`. Add no I/O; the `LLMProvider` stays injected.

**Tests by ring** — domain: plain unit tests, no mocks (`test/pulls-status.test.ts`). Application: build the service with fakes from `src/adapters/mocks.ts` and in-memory stores; no `as unknown as Container`, no `(svc as any).repo = …`. Infrastructure and routes: `*.it.test.ts` with testcontainers (`test/helpers/pg.ts`) or `buildApp({ overrides })` + `app.inject()`.

## Where does X go

| New … | Goes in |
|---|---|
| Endpoint | handler in `modules/<m>/routes.ts` + Zod contract in `server/src/vendor/shared/contracts/` (check the client copy) — a new route is spec-first |
| Use case / orchestration | method on `modules/<m>/service.ts`; it needn't ship with a route |
| Drizzle query, row → domain mapping, transaction | `modules/<m>/repository.ts` |
| Pure rule, calculation, DTO shaping from domain types | `modules/<m>/helpers.ts` or a named pure file (`pulls/status.ts`) |
| Literal, limit, job kind | `modules/<m>/constants.ts` |
| GitHub / LLM / git / search call | port in `adapters.ts` + `src/adapters/<x>/` + `mocks.ts` |
| Facade other modules use | interface in `modules/<m>/types.ts` + `Container` getter (like `repoIntel`) |
| Job handler | `jobs.register` in the wiring block; the handler body calls the service |
| Prompt, grounding, reduce logic | `reviewer-core/src` |
| Env var | `EnvSchema` in `platform/config.ts`, read via `AppConfig` |

## Known deviations — don't copy, don't fix as a side effect

- Drizzle in handlers: `pulls/`, `polling/`, `workspace/`, `settings/routes.ts` (the pulls, polling and settings handlers also call GitHub/LLM ports).
- Drizzle / `db/schema` outside repositories: `pulls/findings-summary.ts`, `pulls/usage-total.ts`, `settings/feature-models.ts`, `reviews/diff-loader.ts`, `reviews/run-executor.ts`.
- `Container` as locator, services `new` their own repository: every `service.ts`, `run-executor.ts`, `diff-loader.ts`, `settings/feature-models.ts`, `repo-intel/pipeline/*`; services built in `routes.ts` and `app.ts` (`new ReviewService(container)`).
- Row types as the domain model: `repos/helpers.ts` (`toRepoDto(row: typeof t.repos.$inferSelect)`), `agents/helpers.ts` and `reviews/helpers.ts` (row types from `./repository.js`) — these helpers are **not** domain and not a model; plus `run-executor.ts`, `diff-loader.ts`.
- Concrete adapters imported by application code: `reviews/diff-loader.ts` → `adapters/git/diff-parser`; `repo-intel/service.ts`, `repo-intel/pipeline/*` → `adapters/astgrep`, `adapters/codeindex/extract`.
- Outward or sideways imports: `adapters/astgrep/index.ts:25` and `adapters/depgraph/index.ts:20` → `modules/repo-intel/constants` (depgraph has NUL bytes, use `grep -a`); `adapters/auth/local.ts` → `db/schema`, `db/seed`; `repos/service.ts` → `../repo-intel/constants`.
- SDK in the core: `reviewer-core/src/llm/openrouter.ts` (`openai`), `llm/structured.ts` (`openai/helpers/zod`).

**Rule:** new code never copies these. `modules/repos/` is the reference for the **file split**, not for DI or row types. A task that touches one of these spots fixes only the lines it changes; a wider cleanup is a separate, spec-first change.

## Red flags — stop

| Thought | Reality |
|---|---|
| "One query, I'll move it to a repository later." | `pulls/routes.ts` is 331 lines of "later". Repository now. |
| "`pulls/routes.ts` / `repos/service.ts` does it this way." | Listed deviation. Neighbour style never overrides the Dependency Rule. |
| "Passing the whole container is simpler." | Service locator: hidden deps, casts in tests. Name the 2–3 deps. |
| "The service already has `this.container`, one more read is free." | That grows the locator. New method = new narrow deps (examples §2b). |
| "The row type matches the domain shape anyway." | Until a column changes; then domain and DTOs change with the schema. Map in the repository. |
| "It's only `import type`, erased at runtime." | The inner ring still knows the outer one. Same violation. |
| "A port method is overkill; call Octokit here." | Port + adapter + mock is three short edits and keeps tests hermetic. |
| "The test needs the private repo: `(svc as any).repo = fake`." | The service builds its own deps. Inject them. |
| "It's a convention nit." | An outward dependency is a design defect: **High**. |

## Review checklist

Items 1–5 are **High** (Dependency Rule broken). 6–10 are **Medium** unless they also break 1–5. Report each as `file:line — ring A → ring B — fix (examples.md §N)`.

1. `drizzle-orm`, `db/schema`, `db/rows` or `$inferSelect` outside infrastructure (route, service, helper, port)?
2. SDK (`octokit`, `openai`, `@anthropic-ai/sdk`, `simple-git`), `process.env` or a token outside `src/adapters/` / `platform/config.ts`?
3. Service/executor takes `Container`, or `new`s its own repository/adapter? Name it: **service locator**.
4. Repository or port signatures leak row/SDK types upward; a `helpers.ts` takes a row type?
5. `reviewer-core` gains I/O or imports `server/src`; an adapter imports `modules/*`; a module imports another module's internals?
6. Route thin (context → one service call) with Zod in `schema:`, not manual `.parse`?
7. Service built in a wiring block, tests use fakes from `adapters/mocks.ts` (no `as unknown as Container`, no `as any`)?
8. Multi-statement writes atomic in one repository method; `tx` kept out of the service?
9. New external capability = port method in domain terms + adapter with `withRetry`/`withTimeout` + mock?
10. New code imitates a Known deviation? Port or contract changed in both `vendor/shared` copies, with a spec?
