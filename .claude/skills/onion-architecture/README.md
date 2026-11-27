# onion-architecture — sources & rationale

This README is the research behind [SKILL.md](SKILL.md): every source the skill relies on, what each one says, where sources disagree, and which stance the skill takes. `SKILL.md` cites sources as `[S#]`; the IDs are defined here. Repo-specific code pairs are in [examples.md](examples.md).

## Scope

**Dependency direction and placement for the backend packages** `server/` and `reviewer-core/`: which ring a file belongs to, what it may import, where Drizzle, Zod, Fastify, DI wiring and external-service calls go, and how to review a diff for these. Not API usage of the libraries themselves.

| Skill | Focus | Owner |
|-------|-------|-------|
| `fastify-best-practices` | Fastify APIs: plugins, hooks, schemas, errors, performance | vendored (mcollina/skills) |
| `drizzle-orm-patterns` | Drizzle schema, queries, relations, transactions, migrations | vendored |
| `zod` | Zod schema APIs | vendored |
| `typescript-expert` | TypeScript types and tooling | vendored |
| `onion-architecture` | **Ring boundaries and placement** on top of the existing DevDigest layout | this repo |

### Decisions taken before writing (user)

1. Rings are **overlaid on the existing layout** (`modules/<m>/routes.ts → service.ts → repository.ts`, `src/adapters/*`, `vendor/shared/adapters.ts`). No folder renames.
2. **Skill only, no enforcement config.** No dependency-cruiser / ArchUnitTS setup is added; the review checklist in SKILL.md is the enforcement. S25–S27 are recorded for a later decision.
3. **Pragmatic domain model.** No Drizzle types in the application or domain rings, but no mandatory rich entities either. Shared Zod contract types (`z.infer`) are valid domain types.

### Why the skill exists (baseline without it, 2026-11-27)

Three subagent runs without the skill (add a `POST /pulls/:id/archive` route; add GitHub label sync to the repos service; review a diff with a planted violation). `server/AGENTS.md` already stopped the obvious "SQL in routes" mistake. What still went wrong:

- Services took the whole `Container` and `new`ed their own repository (service locator).
- Repositories exported `$inferSelect` row types that the service consumed; a pure `helpers.ts` took a schema row type (`toDto(row: $inferSelect)`).
- The service was constructed inside `routes.ts` and the test replaced a private field with `(svc as any).repo = …`.
- The reviewer flagged `new Octokit(process.env…)` + Drizzle in a service only as "Major, convention", not as a Dependency Rule break, and missed the service locator and the row-type leak.

SKILL.md answers these with the DI section, the Drizzle section, the High-severity checklist items 1–5, and the red-flags table.

## Questions the skill answers

| ID | Question |
|----|----------|
| Q1 | Which ring does each existing file belong to? |
| Q2 | What may each ring import; which imports are forbidden? |
| Q3 | Where do Drizzle queries, row types and row → domain mapping live? Who owns a transaction? |
| Q4 | Where does Zod validation happen; is Zod allowed in the core? |
| Q5 | How are services wired (DI container, service locator, composition root)? |
| Q6 | How do GitHub, LLM and git calls cross the boundary? |
| Q7 | How thin is a Fastify route; how is a module encapsulated? |
| Q8 | How is each ring tested? |
| Q9 | How are boundaries enforced (review vs tooling)? |

Status legend: ✅ fetched 2026-11-27 · ⚠️ fetched with a problem (see note).
**Caveat for every ✅:** pages were read through a summarizing fetch tool, not as raw text. Takeaways below reflect that summary. "Not discussed" means the summary did not mention it, which is weaker than "the page does not say it".

---

## Sources

### Onion and related architectures

**S1 — The Onion Architecture: Part 1** · Jeffrey Palermo · blog (2008-07) · ✅ · Q1, Q2
https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/
- Domain model at the center; repository interfaces just outside it; UI, infrastructure and tests on the outer edge.
- All coupling points inward; classic layering leaks coupling from UI to data access transitively.
- The database is an external detail: concrete repositories live at the edge and implement interfaces defined in the core.
- Relies on dependency inversion and a runtime mechanism to inject implementations.

**S2 — The Onion Architecture: Part 2** · Jeffrey Palermo · blog (2008-07) · ✅ · Q2, Q5
https://jeffreypalermo.com/2008/07/the-onion-architecture-part-2/
- Worked example (CodeCampServer): the controller is in the UI layer; the repository and session interfaces it uses are defined in the core and implemented outside.
- Code in the same layer may call each other; the core never reaches outward.
- An IoC container maps interfaces to implementations and injects them through constructors.

**S3 — Onion Architecture: Part 4 – After Four Years** · Jeffrey Palermo · blog (2013-08) · ✅ (via the tag page) · Q1, Q5
https://jeffreypalermo.com/tag/onion-architecture · post: https://jeffreypalermo.com/2013/08/onion-architecture-part-4-after-four-years/
- Four tenets: independent object model; inner layers define interfaces, outer layers implement them; coupling toward the center; the core compiles and runs without infrastructure.
- Works with or without DDD patterns; compatible with CQRS.
- A simpler reference solution omits the IoC container: the container is not essential to the pattern.
- ⚠️ The summary came from the tag page listing part 4, not a separate fetch of the post URL. Part 3 (https://jeffreypalermo.com/2008/08/the-onion-architecture-part-3/) was not fetched.

**S4 — The Clean Architecture** · Robert C. Martin · blog (2012-08) · ✅ · Q1, Q2, Q3
https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- The Dependency Rule: source dependencies point only inward.
- Entities hold enterprise-wide rules; use cases hold application-specific rules and orchestrate entities.
- Interface adapters (controllers, presenters, gateways) translate data; dependency inversion lets control flow outward while dependencies point inward.
- Only simple data structures cross boundaries, not entities or database rows.
- Hexagonal, Onion, Screaming, DCI and BCE are presented as variants of one idea.

**S5 — The Original Hexagonal Architecture Article** · Alistair Cockburn · landing page · ⚠️ · naming only
https://alistaircockburn.com/Articles/Hexagonal-Architecture
- ⚠️ The page returned only a landing blurb: the article dates from 2005, is "still valid", and a 2022 follow-up says "Component+Strategy leads to Ports&Adapters". No technical content on ports/adapters was retrieved, so **the skill cites nothing from it**. The fallback host alistair.cockburn.us was not tried.

**S6 — Onion Architecture** · Herberto Graça · blog (2017-09) · ✅ · Q1, Q2
https://herbertograca.com/2017/09/21/onion-architecture/
- Concentric rings replace the stacked layers; the domain core depends on nothing.
- Inner layers define interfaces, outer layers implement them. An outer layer may call any inner layer directly (no pass-through proxies).
- The core is testable and vendor-independent. In a comment he prefers repository interfaces in the application layer, not the domain.

**S7 — DDD, Hexagonal, Onion, Clean, CQRS… How I put it all together** · Herberto Graça · blog (2017-11) · ✅ · Q2, Q5, Q6
https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/
- Application core = application layer (use cases) + domain layer (entities, value objects, domain services); UI and infrastructure outside.
- Ports are core-owned interfaces **shaped by the core's needs, not by the tool's API**. Driving adapters call in; driven adapters implement ports.
- Components (modules) don't reference each other directly; they communicate through events or a shared kernel, and only the owner changes its data.

**S8 — Onion Architecture** · Allegro Tech (M. Tarczyński) · blog (2023-02) · ✅ · Q3, Q9
https://blog.allegro.tech/2023/02/onion-architecture.html
- Layers: domain, application, infrastructure. Entities carry business rules and guard valid state transitions (rich entities).
- The **application layer decides what is atomic** but depends on a `Transactions` interface implemented in infrastructure; tests can use a no-op fake.
- Enforce layers with build modules or ArchUnit, not just package naming.
- Costs: learning curve, complexity; a poor fit for purely technical services.

**S9 — Onion Architecture: Going Beyond Layers** · NDepend blog · article · ✅ · Q2, Q3, Q6
https://blog.ndepend.com/onion-architecture-layers/
- Layers: domain, domain services, application services, infrastructure; inner layers define interfaces, outer layers implement them.
- The domain must not depend on ORM or framework types. Define domain exceptions and translate technical errors at the edge.
- The pattern adds interfaces and DI wiring overhead.

**S10 — Functional Core, Imperative Shell** · Gary Bernhardt · screencast page · ⚠️ · not cited
https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell
- ⚠️ The fetch returned only site navigation and the title (members-only screencast; paywall not confirmed). **No takeaways are sourced from it.** The idea that `reviewer-core` is a pure core with one injected side effect comes from `reviewer-core/AGENTS.md`, not from this page.

### Node.js / TypeScript

**S11 — The Dependency Rule** · Khalil Stemmler · wiki · ✅ · Q2, Q5
https://khalilstemmler.com/wiki/dependency-rule
- Inner layers (domain) must not reference anything in outer layers; outer layers may depend on inner ones.
- A use case calling a database repository directly breaks the rule; an interface between them (dependency inversion) fixes it.
- A controller calling a use case is compliant.

**S12 — Clean Node.js Architecture** · Khalil Stemmler · article · ✅ · Q2, Q6
https://khalilstemmler.com/articles/enterprise-typescript-nodejs/clean-nodejs-architecture/
- Separate policy (domain rules) from detail (frameworks, libraries); dependencies point inward.
- Ports (interfaces) plus swappable adapters, e.g. email providers.
- A domain without external dependencies is easy to test; heavy abstraction can be overkill for small scripts.

**S13 — Implementing SOLID and the onion architecture in Node.js with TypeScript and InversifyJS** · Remo H. Jansen · DEV (2018) · ✅ (dated) · Q5
https://dev.to/remojansen/implementing-the-onion-architecture-in-nodejs-with-typescript-and-inversifyjs-10ad
- Depend on interfaces, not concrete classes, so layers change independently.
- Repositories and data mappers isolate business logic from storage.
- InversifyJS binds interfaces to implementations in one wiring step.

**S14 — Domain-Driven Hexagon** · Sairyss · GitHub guide · ✅ · Q3
https://github.com/Sairyss/domain-driven-hexagon
- Verified as the original repository (no "forked from" notice). The last ~21k characters of the page were not read.
- Business rules in entities, aggregates and value objects, avoiding anemic models; value objects can replace primitives.
- Ports and adapters keep the core independent of DB and framework; **domain models are separate from persistence models**.
- The author frames it as recommendations and calls it overkill for simple CRUD.

### Fastify

**S15 — The hitchhiker's guide to plugins** · Fastify · official guide · ✅ · Q7
https://fastify.dev/docs/latest/Guides/Plugins-Guide/
- Everything is a plugin added through `register`; each plugin gets its own context, visible to children but not to parents or siblings.
- Hooks can be scoped to a subset of routes through encapsulation; wrap with `fastify-plugin` to share across the app.

**S16 — Plugins (Reference)** · Fastify · official reference · ✅ · Q7
https://github.com/fastify/fastify/blob/main/docs/Reference/Plugins.md
- Each `register` creates a new scope; decorators stay local unless wrapped with `fastify-plugin`.
- Reserved options (`logLevel`, `logSerializers`, `prefix`) are consumed by Fastify; namespace your own options.
- Errors surface through `after`/`ready`; awaiting `register` finalizes encapsulation.

**S17 — Building a Modular Monolith with Fastify** · Matteo Collina · GitNation talk summary page · ✅ (summary page, not the talk) · Q7, Q2
https://gitnation.com/contents/building-a-modular-monolith-with-fastify
- Organize by domain/feature, not MVC layers; modules talk through defined APIs.
- Plugin encapsulation isolates a module's code, routes and data, with no runtime overhead.
- A feature should not read another feature's database tables.

**S18 — @fastify/awilix** · npm · package page · ⚠️ · Q5 (alternative only)
https://www.npmjs.com/package/@fastify/awilix
- ⚠️ npmjs.com returned HTTP 403; no content retrieved. Listed only as a DI-container option the skill did not adopt. Next time try the GitHub repo `fastify/fastify-awilix`.

**S19 — fastify-clean-architecture** · revell29 · GitHub template · ✅ · Q1
https://github.com/revell29/fastify-clean-architecture
- Layers: application (use cases), domain (entities, aggregates, repository interfaces), infrastructure (config, db, webserver), interfaces (controllers, routes, serializers).
- A small template (72 stars, 9 commits at fetch time), not an authoritative reference.

### Drizzle / persistence

**S20 — Transactions** · Drizzle ORM · official doc · ✅ · Q3
https://orm.drizzle.team/docs/transactions
- Statements inside one `transaction` callback commit or roll back together; calling `transaction` on `tx` creates a nested transaction (savepoint).
- You can roll back explicitly inside the callback on a business-rule failure; transactions return values; PostgreSQL supports isolation level, access mode and deferrable options.

**S21 — Atomic Repositories in Clean Architecture and TypeScript** · Sentry blog · article · ✅ · Q3
https://blog.sentry.io/atomic-repositories-in-clean-architecture-and-typescript
- Multi-step operations spanning repositories leave partial writes unless wrapped in one transaction.
- Their design: a transaction manager creates the `tx` in the controller and **passes it through use cases to repositories**, which fall back to the plain driver when no `tx` is given. Uses Drizzle savepoints.

**S22 — Database Architecture Patterns: From Domain Models to Production-Ready Repositories** · shreyas1009 · DEV · ✅ (examples use TypeORM, not Drizzle) · Q3
https://dev.to/shreyas1009/database-architecture-patterns-from-domain-models-to-production-ready-repositories-o6k
- Repositories separate domain logic from persistence for testability.
- CQRS only where read and write needs diverge significantly. Only the repository principle is used here; the TypeORM code is not.

### Zod / boundaries

**S23 — Parse, don't validate** · Alexis King · blog (2019-11) · ✅ (Haskell examples; the principle is language-agnostic) · Q4
https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/
- A validator throws away what it learned; a parser returns a more precise type that keeps it.
- Parse everything at the system boundary before acting; prefer types that make invalid states unrepresentable.

**S24 — Runtime Validation in TypeScript: Where Zod Ends and the Type System Begins** · Gabriel Anhaia · DEV · ✅ · Q4
https://dev.to/gabrielanhaia/runtime-validation-in-typescript-where-zod-ends-and-the-type-system-begins-4e9e
- TypeScript types are erased; casting untrusted input checks nothing.
- Define the Zod schema first and infer the type from it.
- Validate at the edges (HTTP, env, third-party responses), then trust types internally; `safeParse` when you don't want to throw.

### Enforcement (recorded for later; not adopted now)

**S25 — dependency-cruiser rules reference** · sverweij · GitHub doc · ✅ · Q9
https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md
- Rules go in `forbidden`, `allowed` and `required`; `from`/`to` match paths by regex with reusable capture groups.
- Also checks orphans, cycles, unresolvable imports, dependency types; `extends` merges rules by name.
- Note: `server/` already depends on dependency-cruiser as a library (`adapters/depgraph`), not as a lint.

**S26 — Enforce Clean Architecture in Your TypeScript Projects with fresh-onion** · Remo H. Jansen · DEV · ✅ with ⚠️ · Q9
https://dev.to/remojansen/enforce-clean-architecture-in-your-typescript-projects-with-fresh-onion-45pi
- Node/TS has no built-in guard against forbidden cross-layer imports; fresh-onion uses the TS compiler API and an `onion.config.json` mapping layers to directories.
- ⚠️ The fetched summary notes that the article's **prose states the dependency direction opposite to its own example config**. Only the config (outer may import inner, not the reverse) agrees with S1/S4; verify against the page before relying on it.

**S27 — ArchUnitTS** · Lukas Niessen · GitHub · ✅ · Q9
https://github.com/LukasNiessen/ArchUnitTS
- Architecture rules as ordinary tests (Jest, Vitest, Jasmine): dependency direction, cycles, naming, metrics.
- Rules that match zero files fail by default, so a path typo can't pass silently.

---

## Where sources disagree — and the stance this skill takes

| Topic | Positions | Skill's stance |
|-------|-----------|----------------|
| Rich entities vs plain types | Rich, behaviour-bearing entities: Allegro [S8], Domain-Driven Hexagon [S14]. Domain model holds state and behaviour: Palermo [S1]. Only simple data structures cross boundaries: Martin [S4]. Domain free of ORM types: NDepend [S9]. None of the sources endorses anemic models | **Pragmatic** (user decision): no Drizzle row types above the repository, but plain TS types and `z.infer` contracts are valid domain types. Rules live in pure `helpers.ts` functions. Rich entities are allowed, not required |
| DI container vs manual composition | IoC container: Palermo 2008 [S2], InversifyJS [S13], awilix as an option [S18, not retrieved]. Container not essential: Palermo 2013 [S3]. DI wiring is overhead: NDepend [S9] | **Manual wiring**, no DI library. `platform/container.ts` stays the composition root for adapters and shared repos; each module builds its service in a wiring block at the top of its plugin with **narrow deps**. The whole `Container` inside a service is a service locator and is a High review finding |
| Who owns the transaction | Application decides atomicity through a `Transactions` interface: Allegro [S8]. `tx` created in the controller and passed through use cases into repositories: Sentry [S21]. Mechanism only: Drizzle [S20]. Not discussed in the other fetched sources | Default: an atomic write is **one repository method** with `db.transaction`. Cross-repository atomicity: a `withTransaction` / unit-of-work port declared by the application (S8's shape). **`tx` is never passed through a service** (rejects S21's threading, which puts a Drizzle type in the application ring). No such port exists in the repo yet; examples.md §7 is a proposal |
| Where repository interfaces live | Just outside the domain model: Palermo [S1]. Application layer: Graça (comment) [S6]. In the core as ports: Graça [S7], revell29 [S19] | Declared **next to the consuming service** (top of `service.ts` or the module's `types.ts`), in domain types; `repository.ts` satisfies them structurally. Cross-cutting ports stay in `vendor/shared/adapters.ts` |
| Zod in the core | Validate at the edges, then trust the types: King [S23], Anhaia [S24]. Domain free of framework types: NDepend [S9] | Zod is a pure library and the shared contracts are domain types, so Zod **may be imported in the domain** and in `reviewer-core`. Parsing happens once per edge; no re-validation inside |
| Skipping layers | Outer layers may call any inner layer directly: Graça [S6]. Boundaries crossed through interfaces and simple data: Martin [S4]. Use case → concrete repository breaks the rule: Stemmler [S11] | A route may call only its service (and `getContext`). A service depends on a store interface, not on Drizzle. Inner rings are never skipped *outward* |
| Naming: Onion vs Hexagonal vs Clean | Variants of one idea: Martin [S4]. Hexagonal renamed Ports & Adapters; Onion = Ports & Adapters + DDD layers: Graça [S6][S7]. Three layers: Allegro [S8]; four circles: Martin [S4] | One rule (dependencies point inward), one vocabulary: **domain, ports, application, infrastructure, presentation, composition root**, mapped to existing DevDigest files. S5 (Cockburn) is not cited because no content was retrieved |
| Enforcement | Build modules or ArchUnit: Allegro [S8]. Tooling: dependency-cruiser [S25], fresh-onion [S26], ArchUnitTS [S27] | **Review checklist only for now** (user decision). If tooling is added later, ArchUnitTS (runs in Vitest, fails on zero matches) or a dependency-cruiser `forbidden` config are the candidates. That is a separate, spec-first change |
| When the pattern is worth it | Overkill for simple CRUD or scripts: S12, S14; poor fit for purely technical services: S8; adds overhead: S9 | Apply the ring rules to all new backend code; keep the ceremony small (no entity classes, no DI library, one store interface per service) |

---

## Consensus rules (traceability for SKILL.md)

| # | Rule | Sources | SKILL.md section |
|---|------|---------|------------------|
| C1 | Source dependencies point inward only | S1, S3, S4, S6, S11, S12, S13 | The Dependency Rule |
| C2 | The inner ring declares interfaces; the outer ring implements them | S1, S2, S3, S6, S9, S11, S12 | Dependency Rule; Rings table |
| C3 | Database and framework are details at the edge; the domain has no ORM/framework types | S1, S9, S12, S14 | Forbidden imports; Drizzle |
| C4 | Only simple data or domain types cross boundaries, not database rows | S4, S14, S9 | Drizzle; checklist 1, 4 |
| C5 | Ports are shaped by what the core needs, not by the tool's API | S7 | GitHub, LLM, git |
| C6 | The core compiles and is tested without infrastructure | S3, S6, S12 | Tests by ring; reviewer-core |
| C7 | Implementations are injected through constructors; a DI container is optional | S2, S3, S13 | DI and wiring |
| C8 | Modules don't reach into each other's internals or tables | S7, S17 | Forbidden imports |
| C9 | One encapsulated Fastify plugin per module | S15, S16, S17 | Fastify |
| C10 | Parse untrusted data at the boundary, then trust the types | S23, S24 | Zod |
| C11 | Multi-step writes are atomic in one transaction | S20, S21, S8 | Drizzle; examples §7 |
| C12 | Technical errors are translated at the edge into domain errors | S9 | GitHub, LLM, git (`ExternalServiceError`) |
| C13 | Boundaries are enforced by tooling or review, not by folder names alone | S8, S25, S26, S27 | Review checklist |
| C14 | Keep the ceremony proportional; the pattern costs interfaces and wiring | S8, S9, S12, S14 | Disagreements: "worth it" |

Repo facts (no external source; verified in code on 2026-11-27): ports in `server/src/vendor/shared/adapters.ts`; composition in `server/src/platform/container.ts`, `app.ts`, `modules/index.ts`; retry/timeout in `platform/resilience.ts`; error taxonomy in `platform/errors.ts`; fakes in `adapters/mocks.ts`; `fastify-type-provider-zod` wired in `app.ts` and used by every module's `routes.ts` except `workspace/routes.ts`; no `db.transaction` or `withTransaction` anywhere in `server/src`; `reviewer-core` resolves `@devdigest/shared` to `../server/src/vendor/shared` (tsconfig `paths`).

---

## Maintenance

- Last verified: **2026-11-27** (Fastify 5, Drizzle ORM, Zod, `fastify-type-provider-zod` ^4 in `server/`).
- When the code changes, re-check the path references in SKILL.md ("Rings", "Known deviations") and the `path:line` quotes in examples.md: `ls` each path and `grep` each quoted line. Remove a Known deviation once it is fixed.
- If a `withTransaction` port, a DI change, or boundary tooling lands, update the matching row of the disagreements table and the proposals in examples.md §2, §7.
- Link check (last run 2026-11-27: 29 URLs, 27 × 200; npmjs 403; the Fastify `blob/` URL 503 to curl but exists per `gh api`):
  ```sh
  grep -oE 'https://[a-zA-Z0-9./_@#%?=&:~+-]+' README.md | sort -u > urls.txt
  while read -r u; do echo "$(curl -sL -o /dev/null -m 20 -A 'Mozilla/5.0' -w '%{http_code}' "$u") $u"; done < urls.txt
  ```
  Expected non-200: npmjs.com (403, S18). `destroyallsoftware.com` may answer 200 while the content is members-only (S10). GitHub `blob/` URLs may return 429/503 to curl; check them with `gh api repos/<owner>/<repo>/contents/<path>` instead.
