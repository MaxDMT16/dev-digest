---
name: frontend-architecture
description: Use when deciding where frontend code goes or how to split it in React or Next.js — creating, moving or reviewing components, hooks, constants, utils/helpers, API calls, business logic, state, Server vs Client components, Server Actions, data access, env/config, folder structure, import boundaries or barrel files. Architecture and placement, not performance.
---

# Frontend Architecture (React + Next.js)

Placement and structure rules for React 19 / Next.js 15+ apps. `[S#]` = source in [README.md](README.md); ❌ bad → ✅ good code in [examples.md](examples.md). Performance and hook-level anti-patterns: `react-best-practices`. Next.js API details: the official docs.

## Precedence — read first

1. **Package rules win.** The package's `AGENTS.md`/`CLAUDE.md` (and `INSIGHTS.md`) override this skill.
2. **Then the existing local convention.** Before creating a file, look at 2–3 sibling folders and copy their structure, naming case and file split. When siblings disagree, follow the newest or most refactored ones. **One structure per codebase** [S11]: don't introduce `features/`, `shared/`, `domain/` or a new naming case next to an existing layout.
3. **Then the rules below.** They decide *which level* code belongs to; the convention decides *what that level is called*.
4. **Change only what the task needs.** Lines you write follow these rules. Existing lines stay as they are, even in a file you edit: don't restructure or rewrite their imports as a side effect. When an established pattern differs from a rule here (client pages, an aggregate barrel), follow the pattern and say so. A migration is a separate, agreed change.

## Core principles

1. **Colocate, then promote.** Placement is decided by **who uses the code**: next to its only consumer; promote one level up when a consumer *outside* the current folder/route subtree appears; demote when it loses one [S30][S33].
2. **Organize by feature/route, not by file type,** once the app has more than a handful of screens. Type folders only for genuinely generic shared code [S25][S27].
3. **One-way dependencies:** shared → features → routes/app. Sibling features/routes never import each other's private code; promote it or compose in the page. Enforce with `import/no-restricted-paths` / `eslint-plugin-boundaries` [S25][S48][S49].
4. **Reuse before writing; abstract late (AHA).** Before writing a helper, constant or component, **search for an existing one** and reuse or promote it. Moving an *identical* function up a level for a second consumer is promotion, and it's always fine. *Generalizing* similar-but-different code (new params or flags to cover cases) waits for the third real use: duplication beats the wrong abstraction [S40].

## Where things go — quick reference

Pick the column by consumers, then use the repo's name for that level.

| What | One file | One component folder / route subtree | Several routes / features |
|------|----------|--------------------------------------|---------------------------|
| Component | same file (small, private) | `_components/<Name>/` in the route or parent component | shared `components/` |
| UI hook (local state, DOM, orchestration) | same file | `<Name>/hooks/` | shared hooks module |
| Data hook (query/mutation) | — | with the API layer (feature `api/`, or the repo's hooks module) | same |
| Constant | module-level `const`, or the component's `constants.ts` if that is the convention | `<Name>/constants.ts` or route-level `constants.ts` | `config/` (app-wide) or the domain module it belongs to |
| Helper / business rule (pure) | module-level function | `<Name>/helpers.ts` or route-level `helpers.ts` | domain module in `lib/` (`lib/<domain>.ts`) |
| Generic util (domain-free) | module-level | same as helper | `lib/<topic>.ts`, one topic per file |
| Test | next to the file it tests | | e2e at repo level |

## Components (R1, R2)

- **Split for a reason** [S38][S41][S1]: mixed responsibilities, reuse, unclear state ownership, an edge case you can't test alone, >5–7 props. **Line count alone is not a reason.**
- **No components or `renderX()` functions defined inside a component** — extract a real component [S41].
- **Boolean-prop pile-up** (`compact`, `showX`, `hideY`…) → a `variant` union, composition via `children`/slots, or compound components [S39]. Across a Server/Client boundary use named exports, not `Card.Header` statics [S13].
- **No container/presentational split** — extract stateful logic into a hook [S35][S37].
- Pages/route components **compose**; business rules live in helpers/domain modules.
- Before creating a primitive (badge, button, popover), check the UI kit and shared `components/`.

## Helpers, utils, hooks, lib (R4)

| Kind | Definition | Naming |
|------|------------|--------|
| helper / domain function | knows your domain (`countBySeverity`, `isReviewStale`) — a "domain module" is just the file holding these | plain verb/predicate; no `use` prefix |
| util | domain-free, copy-pastable to any project (`clamp`, `relativeTime`) | one topic per file |
| hook | calls other hooks; named by purpose (`useFindingAction`) | `useX` only if it calls hooks [S3] |
| lib module | wrapper over a third-party/infra concern (API client, i18n, toast) | one purpose per module [S27] |

❌ A `utils.ts`/`helpers.ts` dumping ground mixing dates, severities and API mapping across features — it outlives its consumers and hides ownership [S33].

## Business logic (R5)

Four thin layers [S42][S43]:
1. **View** — JSX, event wiring, loading/error UI.
2. **Hook** — UI state + orchestration (calls data hooks and domain functions).
3. **Domain** — plain TS functions, **no React, no fetch**, unit-tested directly [S53].
4. **API layer** — one client; per-resource request functions/data hooks returning frontend-shaped data; components never call `fetch` or parse raw responses [S26].

Add a use-case/service layer only when real multi-step logic exists [S43]. Before adding a data hook, check that the backend endpoint and contract exist — a missing endpoint makes it a cross-package change.

## State (R6)

Order [S47][S1][S5][S7]: local `useState` → push down to the one child that uses it → lift to the closest common parent → URL (`searchParams`) for shareable UI state → composition (`children`) → context per domain (provider as deep as possible) → global store last.

- **Server data lives in the query cache**, read via data hooks (`select` for a slice). ❌ Never copy it into `useState`/store or sync it with an Effect [S45]. ✅ A context may expose values *derived from the query on each render* (pass-through), plus UI state such as the selected ID.
- Query keys: follow the repo's key style consistently (a key factory if one exists); invalidation must use the same keys [S45].
- **Derive, don't store**; store IDs, not copies; one status union instead of contradicting booleans [S4][S2].

## Next.js boundaries (N1, N2)

- `app/` is routing: `page`/`layout`/`loading`/`error` + colocated `_components` and route-level helpers. `(group)` for sections/layouts without URL change [S11].
- **Server Components by default** when the data model allows it; `'use client'` on the smallest interactive leaf, not on a layout [S12][S9]. In an app whose data is fetched client-side (React Query against an external API), client pages are an accepted convention — follow it.
- Pass server-rendered content into client wrappers as `children`; providers wrap `{children}` as deep as possible [S12][S44].
- Props crossing the boundary must be serializable [S13]. `import 'server-only'` on DB/secret/session code, `'client-only'` on browser-only code [S12].

## Next.js data and mutations (N3)

- **One data model per app** [S15]: (a) external backend API via client data hooks, or (b) a server-only Data Access Layer. Don't mix ad-hoc DB calls into components.
- **DAL** (model b): `server-only`, checks auth *and* ownership, returns minimal DTOs, sole reader of secrets [S14][S16].
- ❌ A Server Component fetching its own `/api/*` Route Handler — call the data source directly [S18][S23].
- **Server Actions** (model b; `actions.ts`, file-level `'use server'`) are public POST endpoints: validate (Zod) → authorize → DAL → revalidate → `redirect` outside `try` [S17][S14]. Mutations only.
- **Route Handlers** are for external callers: webhooks, OAuth callbacks, files/feeds [S18].
- Client-side query libraries fit model (a), polling, infinite lists and optimistic updates [S46].

## Env, layouts, errors, metadata, strings (N4, N5)

- Env: one typed `env.ts` (Zod, split `server`/`client`). Unprefixed = server-only; `NEXT_PUBLIC_*` is fixed at build time, not runtime config [S19][S52].
- Layouts are shells, **not auth gates** [S16]. Expected errors are returned values; unexpected errors throw to the nearest `error.tsx` [S20]. `metadata` only in Server `layout`/`page` [S21].
- User-visible strings go through the i18n layer if the app has one, including units produced by helpers. A helper either returns numbers and lets the component format them with `t(...)`, takes the translated label as a parameter, or uses `Intl.NumberFormat` / `Intl.RelativeTimeFormat` with the current locale.

## Imports and barrels

- New import lines: `@/` alias across top-level areas, relative imports inside one component or feature folder [S25]. If the module is already imported, add the symbol to that existing statement. Leave existing deep relative imports alone (precedence rule 4).
- ❌ Creating new `export *` barrels per folder or feature (they cause cycles and slow dev and test runs) [S50][S51]. ✅ A thin `index.ts` that re-exports the one component of its folder. An **existing** aggregate barrel (e.g. a hooks index) stays: register a new sibling module in it the same way the others are.
- Boundaries can be enforced with `import/no-restricted-paths` or `eslint-plugin-boundaries` [S48][S49]. If the package has no lint setup, the reviewer enforces them.

## Version notes

Next 15: `params`/`searchParams`/`cookies()`/`headers()` are async; GET Route Handlers not cached by default. Next 16: `middleware.ts` → `proxy.ts`, `"use cache"`, `updateTag()`/`refresh()`, `revalidateTag(tag, profile)` [S22]. For API specifics read the installed version's docs (`node_modules/next/dist/docs/` on 16.2+) [S24].

## In this repo (`client/`)

Rules in `client/AGENTS.md` win (spec-first triggers, hooks, i18n). Mapping of the levels above:

| Level | Path |
|-------|------|
| Page | Newer pattern (follow it for new pages): a thin Server `page.tsx` that renders a `'use client'` `<Name>View` from `_components/`, as in `src/app/agents/page.tsx`. Older pages (`pulls/`, `pulls/[number]/`, `agents/[id]/`, `onboarding/`, root) are fully `'use client'`. Don't convert them as a side effect |
| Route-private component | `src/app/**/_components/<Name>/` with `<Name>.tsx` + `index.ts` (one-component re-export), plus `constants.ts`, `helpers.ts`, `styles.ts`, `hooks/`, nested `_components/` and `<Name>.test.tsx` **only when needed** (see `src/app/agents/[id]/_components/AgentEditor/`, `src/app/repos/[repoId]/pulls/_components/PrFindingsCell/`) |
| Route-level helpers/constants | `helpers.ts`, `constants.ts`, `styles.ts` beside `page.tsx` for code shared by several components of that route (see `src/app/repos/[repoId]/pulls/`) |
| Cross-route UI | `src/components/<kebab-name>/` (`app-shell`, `run-cost-badge`). `app-shell`, `page-shell` and `showcase` already have `export *` indexes; leave them as they are |
| UI kit | `@devdigest/ui` → `src/vendor/ui` (e.g. `SeverityBadge`) — reuse, **never edit** |
| Data hooks | `src/lib/hooks/<area>.ts` (query and mutation hooks together), added to the existing `src/lib/hooks/index.ts` barrel like its siblings. All requests go through `src/lib/api.ts` |
| Domain helpers / shared constants | `src/lib/<topic>.ts`, one topic per file. `findings.ts` holds findings and severity; `format-usage.ts` is the single source for cost/token display only. Shared types live in vendored `@devdigest/shared`, which must not be edited, so their helpers and constants go here |
| Strings | `messages/en/<namespace>.json` via `next-intl` |

- Data model (a): client-side React Query against the Fastify API. There is no DAL and there are no Server Actions.
- Query keys are inline literals (`["reviews", prId]`). Changing keys or caching is a spec-first change.
- There is no ESLint setup, so import boundaries are enforced in review.
- Known duplication: the severity order is redeclared in `RunHistory.tsx`, `PrFindingsCell.tsx` and `FindingsPanel/constants.ts`. When a task touches it, reuse or promote it into `src/lib/findings.ts`; don't add a fourth copy.
- Read `client/INSIGHTS.md` for single sources of truth (cost display only via `format-usage.ts` / `RunCostBadge`, etc.).

## Review checklist

1. Does the new code follow the package rules and its siblings' structure, naming and imports?
2. Is each helper/constant/hook at the narrowest level covering all its consumers — and did you reuse an existing one instead of creating a duplicate?
3. Does any feature/route import another's private code?
4. Is domain logic in plain TS (testable without rendering), not in JSX or Effects?
5. Is server data read from the query cache rather than copied into state?
6. Any `renderX()` inside components, or a growing pile of boolean props?
7. Is `'use client'` placed per the data model and convention, as low as possible?
8. (DAL apps) Do actions/route handlers validate *and* authorize? Does any Server Component fetch its own `/api`?
9. Any new `export *` barrel, dumping-ground `utils`, or hard-coded user-visible string?
10. Does the backend endpoint/contract exist — or is this a cross-package change that needs a spec?
