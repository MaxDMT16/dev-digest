# frontend-architecture — sources & rationale

This README is the research behind [SKILL.md](SKILL.md): every source the skill relies on, what each one says, where sources disagree, and which stance the skill takes. `SKILL.md` cites sources as `[S#]`; the IDs are defined here.

## Scope

**Architecture only — not performance.** Where code goes and how it is split: components, constants, utils/helpers, hooks, business logic, state placement, import boundaries, the Next.js Server/Client boundary and data access.

How it relates to the other frontend skills in `.claude/skills/`:

| Skill | Focus | Owner |
|-------|-------|-------|
| `react-best-practices` | Hooks/state anti-patterns, performance; only 2 lines on code organization | vendored |
| `next-best-practices` | Next.js APIs and file conventions; retired upstream in favour of docs bundled with Next 16.2+ [S24] | vendored (vercel-labs) |
| `frontend-architecture` | **Placement and structure decisions** — the part framework docs call "unopinionated" [S11] | this repo |

Target versions: React 19, Next.js 15.5 (what `client/` uses), with notes on Next 16 changes.

## Questions the skill answers

| ID | Question |
|----|----------|
| R1 | Where do components live (feature vs type folders, colocation)? |
| R2 | How are components split (responsibility, containers vs hooks, compound components)? |
| R3 | Where do constants live? |
| R4 | What goes into utils / helpers / lib / hooks / services? |
| R5 | Where does business logic live (hooks, domain, API layer)? |
| R6 | State placement, import boundaries, barrel files, naming, testing |
| N1 | Next.js folder structure: `app/`, `src/`, `_private`, `(groups)`, colocation |
| N2 | Server vs Client Components boundary |
| N3 | Data access, DAL, Server Actions vs Route Handlers, validation |
| N4 | Env and config |
| N5 | Layouts, error/loading boundaries, metadata |
| N6 | Combining Next.js with a feature-based structure |

Status legend: ✅ fetched and verified (2026-11-27) · ⚠️ not fetched directly — see note.

---

## Sources

### Official React docs (react.dev)

**S1 — Thinking in React** · React team · official doc · ✅ · R2, R6
https://react.dev/learn/thinking-in-react
- Split UI by single responsibility; if a component grows, decompose it. The component tree often mirrors the data shape.
- State is the minimal changing data: not state if it never changes, comes from props, or can be computed.
- State goes in the closest common parent of its consumers; create a wrapper component if none fits.

**S2 — You Might Not Need an Effect** · React team · official doc · ✅ · R5, R6
https://react.dev/learn/you-might-not-need-an-effect
- Derive values during render; don't mirror props/state into state via Effects.
- Logic caused by a user action belongs in the event handler; Effects only for logic caused by the component being displayed.
- Prefer framework data fetching; otherwise wrap fetching in a custom hook. "The fewer raw useEffect calls … the easier to maintain."
- Reset state with a `key`, not an Effect.

**S3 — Reusing Logic with Custom Hooks** · React team · official doc · ✅ · R4, R5, R6
https://react.dev/learn/reusing-logic-with-custom-hooks
- `use` prefix only for functions that call hooks; a pure helper is `getSorted`, not `useSorted`.
- Hooks share logic, not state — each call has its own state.
- Name hooks by concrete purpose (`useChatRoom`, `useOnlineStatus`); avoid lifecycle hooks like `useMount`.
- Over time most Effects should live inside custom hooks.

**S4 — Choosing the State Structure** · React team · official doc · ✅ · R6
https://react.dev/learn/choosing-the-state-structure
- Group related state; replace contradictory booleans with one status (`'typing' | 'sending' | 'sent'`).
- No redundant or duplicated state — store an ID, not a copy of the object.
- Flatten deep nesting into ID-keyed tables.

**S5 — Sharing State Between Components** · React team · official doc · ✅ · R6
https://react.dev/learn/sharing-state-between-components
- Lift state to the common parent; pass values and handlers down. One owner per piece of state.
- Decide controlled vs uncontrolled; expect state to move up and down as the app evolves.

**S6 — Keeping Components Pure** · React team · official doc · ✅ · R5
https://react.dev/learn/keeping-components-pure
- Rendering is pure: same props/state/context → same JSX, no mutation of pre-existing values.
- Side effects go to event handlers first, `useEffect` last.

**S7 — Passing Data Deeply with Context** · React team · official doc · ✅ · R6
https://react.dev/learn/passing-data-deeply-with-context
- Before context, try props, then extracting components and passing JSX as `children`.
- Context fits theme, current account, routing, app-wide reducer state.

**S8 — Scaling Up with Reducer and Context** · React team · official doc · ✅ · R4, R6
https://react.dev/learn/scaling-up-with-reducer-and-context
- One file holds reducer + state/dispatch contexts + provider.
- Export custom hooks (`useTasks`, `useTasksDispatch`) so components never touch context objects directly.

**S9 — `'use client'`** · React team · official reference · ✅ · N2
https://react.dev/reference/rsc/use-client
- Marks the **module dependency tree**, not the render tree; must be the first statement.
- Everything imported by a `'use client'` module becomes client code.

**S10 — `'use server'`** · React team · official reference · ✅ · N2, N3
https://react.dev/reference/rsc/use-server
- Marks Server Functions (not Server Components); file-level or function-level; async only.
- Server Functions are for mutations, not fetching. Treat every argument as untrusted — validate and authorize inside.

### Official Next.js / Vercel

**S11 — Project structure and organization** · Vercel · official doc (updated 2026-07) · ✅ · N1, N5, R1
https://nextjs.org/docs/app/getting-started/project-structure
- Unopinionated: (a) project files outside `app/`, (b) top-level folders inside `app/`, (c) split by feature/route. "Choose a strategy and be consistent."
- Colocation in `app/` is safe — only `page`/`route` make a segment public. `_private` folders separate UI from routing and avoid future convention clashes.
- Route groups `(name)` organize by section/team, scope a layout or `loading` to some routes, and allow multiple root layouts.
- `src/` is optional; `.env*` stays at the project root.

**S12 — Server and Client Components** · Vercel · official doc (updated 2026-10) · ✅ · N2, N4
https://nextjs.org/docs/app/getting-started/server-and-client-components
- Pages/layouts are Server Components by default; use client only for state, handlers, effects, browser APIs, custom hooks.
- Put `'use client'` on the interactive leaf, not on a layout.
- Interleave: pass Server Components as `children`/props into client wrappers. Providers wrap `{children}` as deep as possible.
- Wrap third-party client-only components in your own `'use client'` file; use `server-only` / `client-only` to fail the build on wrong-environment imports.

**S13 — The Server and Client Boundary** · Vercel · official guide (updated 2026-10) · ✅ · N2
https://nextjs.org/docs/app/guides/server-and-client-boundary
- Code crosses the boundary through imports, data through props; props must be serializable. Server Functions pass as references (name them `action`/`*Action`).
- Owner ≠ parent: a component owned by a Server Component renders on the server even under a client parent.
- Compound components with static members (`Menu.Item`) break across the boundary — use named exports.

**S14 — How to think about data security in Next.js** · Vercel · official guide (updated 2026-11) · ✅ · N3, N4
https://nextjs.org/docs/app/guides/data-security
- A Data Access Layer is server-only, authorizes, and returns minimal DTOs; taint APIs are only a safety net.
- Mutations go through the DAL too (`data/posts.ts` with `server-only`); the `'use server'` action stays thin.
- Server Actions are reachable by direct POST — a page-level auth check doesn't protect them. Check authorization (ownership), not just authentication; never return raw DB rows.
- Never mutate during render.

**S15 — How to Think About Security in Next.js** · Sebastian Markbåge, Vercel · blog (2023-10) · ✅ · N3, N4
https://nextjs.org/blog/security-nextjs-server-components-actions
- Pick **one** data model: HTTP APIs (zero trust), a DAL (new projects), or component-level queries (prototypes only).
- Only the DAL reads `process.env` secrets and imports DB packages; every function checks the current user via a `cache()`d `getCurrentUser`.
- Audit checklist: DAL, `"use client"` props, `"use server"` args, `[param]` folders, middleware/route files.
- ⚠️ Written for Next 14 (sync `cookies()`, `middleware.tsx`) — use S14 for current APIs.

**S16 — Authentication guide (DAL/DTO sections)** · Vercel · official guide (updated 2026-09) · ✅ · N3, N5
https://nextjs.org/docs/app/guides/authentication
- `app/lib/dal.ts` with `import 'server-only'` and `verifySession = cache(...)`, used by data functions, actions and route handlers.
- `React.cache` dedupes only within a render pass, not in actions/route handlers.
- **Don't auth-gate in layouts** — they don't re-render on navigation and don't stop child segments/actions. Check close to the data.
- Proxy/middleware only for optimistic cookie checks. Zod validation in the action; schemas in a shared `definitions.ts`.

**S17 — Mutating Data (Server Functions)** · Vercel · official doc (updated 2026-10) · ✅ · N3
https://nextjs.org/docs/app/getting-started/mutating-data
- Actions defined inline in Server Components or in a file-level `'use server'` module (`actions.ts`); Client Components import only the latter or receive actions as props.
- Every action starts with an auth check; then mutate → `revalidatePath`/`revalidateTag` → `redirect` last (it throws).
- Server Functions are dispatched one at a time — not for parallel fetching.

**S18 — Backend for Frontend (Route Handlers & Proxy)** · Vercel · official guide (updated 2026-11) · ✅ · N3
https://nextjs.org/docs/app/guides/backend-for-frontend
- Route Handlers are public HTTP endpoints: webhooks, OAuth callbacks, non-HTML content, external consumers, proxying a backend.
- **Server Components must not fetch their own Route Handlers** — call the data source directly.
- Client polling / browser-dependent data → SWR or React Query. Don't rely on proxy alone for auth.

**S19 — Environment Variables** · Vercel · official guide (updated 2026-08) · ✅ · N4
https://nextjs.org/docs/app/guides/environment-variables
- Unprefixed vars are server-only (empty in the browser). `NEXT_PUBLIC_*` is inlined at build time and frozen; dynamic `process.env[name]` is not inlined.
- Runtime config: read env on the server during dynamic rendering and pass it down. `.env*` lives at the root even with `src/`.

**S20 — Error Handling / `error.js`** · Vercel · official docs (updated 2026-10) · ✅ · N5
https://nextjs.org/docs/app/getting-started/error-handling · https://nextjs.org/docs/app/api-reference/file-conventions/error
- Expected errors are return values (`useActionState`); unexpected errors throw to the nearest `error.tsx`.
- `error.tsx` is a Client Component and doesn't wrap its own segment's layout; root needs `global-error.tsx`.
- `notFound()` + `not-found.tsx`. ⚠️ `retry` replaced `reset` in Next 16.3.

**S21 — Metadata and OG images** · Vercel · official doc (updated 2026-08) · ✅ · N5
https://nextjs.org/docs/app/getting-started/metadata-and-og-images
- `metadata`/`generateMetadata` only from Server Component `layout`/`page`; file-based metadata in the segment folder.
- Wrap the data function in `React.cache` to share one fetch between metadata and page.

**S22 — Next.js 15 and Next.js 16 release posts** · Vercel · official blog (2024-10, 2025-10) · ✅ · version caveats
https://nextjs.org/blog/next-15 · https://nextjs.org/blog/next-16
- 15: async `cookies`/`headers`/`params`/`searchParams`; GET Route Handlers and the client router cache no longer cached by default.
- 16: `middleware.ts` → `proxy.ts`; Cache Components / `"use cache"` (opt-in caching); `revalidateTag(tag, profile)`; `updateTag()` and `refresh()` in actions; parallel slots need `default.js`.

**S23 — Common mistakes with the App Router** · Lee Robinson, Vercel · blog (2024-01) · ✅ · N2, N3, N5
https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them
- Don't call your own Route Handlers from Server Components; use Server Actions for client mutations; revalidate after mutations; no `redirect()` inside `try/catch`.
- `'use client'` only on boundary files; `<Suspense>` above the async component.
- ⚠️ "GET Route Handlers cached by default" is outdated since Next 15.

**S24 — AI agents guide, "AGENTS.md outperforms skills", vercel-labs/next-skills** · Vercel · official doc + blog (2026-01) + repo · ✅ · skill design
https://nextjs.org/docs/app/guides/ai-agents · https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals · https://github.com/vercel-labs/next-skills
- No official architecture skill exists; `next-best-practices` was retired — Next 16.2+ ships docs in `node_modules/next/dist/docs/`.
- In Vercel's evals agents skipped skills in 56% of runs; a docs index in AGENTS.md scored best. → Keep this skill short and opinionated, tune its description, and point to bundled docs for API detail.

### Structure methodologies

**S25 — Bulletproof React: Project Structure & Standards** · Alan Alickovic · repo docs (2024 rewrite) · ✅ · R1, R4, R6, N6
https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md · https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md · https://github.com/alan2207/bulletproof-react/tree/master/apps/nextjs-app
- `src/`: `app, components, config, features, hooks, lib, stores, testing, types, utils`; most code in `features/<name>/{api,components,hooks,stores,types,utils}` — only the subfolders it needs.
- **Features don't import each other**; compose at app level. Flow shared → features → app, enforced with `import/no-restricted-paths`.
- Avoid barrel files; `@/*` alias; kebab-case enforced by lint.

**S26 — Bulletproof React: API Layer & State Management** · Alan Alickovic · repo docs · ✅ · R4, R5, R6
https://github.com/alan2207/bulletproof-react/blob/master/docs/api-layer.md · https://github.com/alan2207/bulletproof-react/blob/master/docs/state-management.md
- One API client in `lib/`; per endpoint in `features/x/api/`: types/schema + fetcher + query/mutation hook.
- Five state kinds — component, application, server cache, form, URL — each with its own tool; keep app state as local as possible.

**S27 — Feature-Sliced Design: Overview, Layers, Slices & Segments** · FSD team · methodology spec (v2.1) · ✅ · R1, R3, R4, R5, R6
https://feature-sliced.design/docs/get-started/overview · https://feature-sliced.design/docs/reference/layers · https://feature-sliced.design/docs/reference/slices-segments
- Layers `app › pages › widgets › features › entities › shared`; import only from lower layers; no cross-imports between slices on the same layer.
- Segments named by **purpose** (`ui`, `api`, `model`, `lib`, `config`), not by type (`components`, `hooks`, `types` are called bad names).
- `shared/lib` is not "helpers/utils": each lib has one focus area. Constants in `shared/config` or a slice's `config` segment.
- Don't over-create features: a big block used on one page belongs to that page.

**S28 — FSD: Public API** · FSD team · spec · ✅ · R6
https://feature-sliced.design/docs/reference/public-api
- Each slice exposes an `index` as its public API; no `export *`; outside code imports only through it.
- Admits barrel costs (cycles, tree-shaking, dev-server speed); mitigation: one index per component in `shared/ui`, no indexes for segments inside slices. Enforced by the Steiger linter.

**S29 — FSD: Usage with Next.js** · FSD team · guide · ✅ · N1, N3, N6
https://feature-sliced.design/docs/guides/tech/with-nextjs
- Next `app/` stays at the root and only re-exports pages from `src/`; FSD layers renamed `_app`/`_pages` to avoid clashes.
- DB queries in `shared/db`; server-only exports through `index.server.ts`.
- ⚠️ Still says "middleware" (Next 16: `proxy.ts`).

**S30 — React Folder Structure in 5 Steps** · Robin Wieruch · blog (updated 2026-05) · ✅ · R1, R3, R4, R6
https://www.robinwieruch.de/react-folder-structure/
- Grow in steps: file → multiple files → folder per component → technical folders → feature folders; keep nesting ≤ 2 levels.
- A hook used by one component stays beside it. **Promotion rule:** one feature uses it → stays in the feature; two or more → shared (and back again when that stops).
- `index.js` optional (barrels hurt tree-shaking). Kebab-case files.

**S31 — Feature Architecture in React/Next** · Robin Wieruch · blog (2024-11) · ✅ · N3, N6
https://www.robinwieruch.de/react-feature-architecture/
- `src/features/<feature>/{components,queries}/`; small single-purpose queries (`getPost`, `getComments`).
- Features stay decoupled: a feature component fetches its own data from an ID; the page composes features. Watch for N+1 on lists.

**S32 — Delightful React File/Directory Structure** · Josh W. Comeau · blog (updated 2025-12) · ✅ · R1, R3, R4
https://www.joshwcomeau.com/react/file-structure/
- Folder per component with an `index.ts` forwarding to the component file.
- Component-only files sit inside the folder: `Widget.helpers.ts`, `Widget.constants.ts`, `Widget.types.ts`.
- Top-level `hooks/` for reusable hooks; `helpers/` for project-domain helpers; `utils.ts` for generic, copy-to-any-project helpers; `constants.ts` for app-wide constants.

**S33 — Colocation** · Kent C. Dodds · blog (2019) · ✅ · R1, R3, R4
https://kentcdodds.com/blog/colocation
- "Place code as close to where it's relevant as possible" — tests, styles, helpers.
- Utils-folder anti-pattern: helpers moved to `utils/` outlive their only consumer. Keep single-use helpers with the consumer.

**S34 — nextjs-clean-architecture** · Lazar Nikolov · repo · ✅ · N3, N6
https://github.com/nikolovlazar/nextjs-clean-architecture
- Layers: `app/` → interface-adapters (controllers) → application (use cases + interfaces) → entities → infrastructure, with DI.
- Server Actions and Route Handlers are thin adapters over controllers.
- The README itself calls it overkill unless the project will grow — the heavy end of the spectrum.

### Component design

**S35 — Presentational and Container Components (2019 note)** · Dan Abramov · blog (2015, note 2019) · ⚠️ Medium returned 403; quote verified via https://blog.logrocket.com/how-to-convert-your-existing-redux-containers-to-hooks · R2, R5
https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0
- "I don't suggest splitting your components like this anymore … enforced without any necessity and with almost dogmatic fervor."
- Hooks do the same job without an arbitrary division — extract stateful logic to hooks, not wrapper components.

**S36 — Writing Resilient Components** · Dan Abramov · blog (2019) · ✅ · R2, R6
https://overreacted.io/writing-resilient-components/
- Don't stop the data flow — don't copy props into state.
- Components must render at any time: fully controlled or fully uncontrolled, reset with `key`.
- No singletons: a component must work when rendered twice; shared data goes in a cache/store.

**S37 — Patterns.dev: Container/Presentational, Compound** · Lydia Hallie & Addy Osmani · guide · ⚠️ not fetched (DNS failure); content from search snippets · R2
https://www.patterns.dev/react/presentational-container-pattern · https://www.patterns.dev/react/compound-pattern
- Hooks replace most container components while keeping the view pure.
- Compound components (parent state in context, children consume it) for parts that belong together: Select/Option, Menu/Item.

**S38 — When to break up a component into multiple components** · Kent C. Dodds · blog (2019) · ✅ · R2
https://kentcdodds.com/blog/when-to-break-up-a-component-into-multiple-components
- **Size alone is not a reason to split.** Split for reuse, unclear state ownership, untestable edge cases, merge conflicts, messy imperative code.
- Premature splitting causes prop drilling. "Duplication is far cheaper than the wrong abstraction."

**S39 — Compound Components with Hooks; Inversion of Control** · Kent C. Dodds · blog (2019) · ✅ · R2
https://kentcdodds.com/blog/compound-components-with-react-hooks · https://kentcdodds.com/blog/inversion-of-control
- Compound components: parent holds state in context; `useXContext` throws outside the parent.
- When every new use case adds a boolean prop, invert control (compound components, state reducers, callbacks) — not for a single use case.

**S40 — AHA Programming; The Wrong Abstraction** · Kent C. Dodds (2020); Sandi Metz (2016) · blogs · ✅ · R2, R4
https://kentcdodds.com/blog/aha-programming · https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction
- Abstract only after seeing several real uses and how they differ.
- Warning sign: a shared helper/component keeps gaining parameters and conditionals → inline it back into callers, then re-abstract.

**S41 — Tao of React** · Alex Kondov · guide (2021) · ✅ · R1, R2, R3, R5
https://alexkondov.com/tao-of-react/
- Organize by module/domain; avoid top-level `containers/` and `components/`.
- No render functions inside components — make them components. Extract lists and complex conditionals. More than ~5 props is a split signal.
- Helpers outside the component, pure, values passed as arguments. Static arrays/objects at module level.
- Use React Query/SWR instead of hand-written service boilerplate; wrap third-party components.

### Business logic and API layer

**S42 — Modularizing React Applications with Established UI Patterns** · Juntao Qiu, martinfowler.com · article (2023-02) · ✅ · R2, R4, R5
https://martinfowler.com/articles/modularizing-react-apps.html
- Layers: **view** (thin JSX), **hooks** (UI state, orchestration), **domain** (plain TS, no React/network), **data gateway** (fetch + convert to domain objects).
- Replace scattered string checks with domain objects; replace country-specific `if`s with an injected strategy.
- Domain logic is framework-free and unit-testable.

**S43 — Path to a Clean(er) React Architecture (8 parts)** · Johannes Kettmann (profy.dev) · blog series (2024) · ⚠️ profy.dev did not resolve; verified on the author's DEV mirror · R4, R5, R6
https://dev.to/jkettmann/series/27067
- One shared API client; fetch functions per resource (`api/user.ts`) return frontend-shaped data and accept domain inputs — components never see raw responses.
- Domain functions under `domain/<entity>/` instead of generic utils; testable without RTL.
- Use cases as plain functions with deps injected via a hook — **skip that layer when there is no real logic**.
- React Query hooks are the bridge between components and services.

**S44 — Making Sense of React Server Components** · Josh W. Comeau · blog (2023, updated 2025-05) · ✅ · N2
https://www.joshwcomeau.com/react/server-components/
- Server Components render once — no state or effects.
- The client boundary is per module; everything imported below it is client code.
- To nest server output in interactive UI, the server parent owns both and passes server content as `children`.

### State and server cache

**S45 — Practical React Query; Effective Query Keys; React Query as a State Manager** · Dominik Dorfmeister (TkDodo) · blog (2020–2023) · ✅ · R4, R5, R6
https://tkdodo.eu/blog/practical-react-query · https://tkdodo.eu/blog/effective-react-query-keys · https://tkdodo.eu/blog/react-query-as-a-state-manager
- React Query is an async state manager — **never copy query data into local state or a global store**.
- Wrap each `useQuery` in a custom hook; colocate `features/x/queries.ts` with a query-key factory; export only hooks.
- Calling the query hook wherever data is needed is fine (deduped by key) — an alternative to prop drilling.

**S46 — You Might Not Need React Query** · TkDodo · blog (2023-05) · ✅ · N3
https://tkdodo.eu/blog/you-might-not-need-react-query
- If fetching is server-only via RSC, a client cache adds nothing.
- Keep React Query for client needs: infinite scroll, polling, offline, optimistic updates; or prefetch on server + hydrate.
- One owner per piece of data — don't fetch the same data on both sides.

**S47 — Application State Management with React; State Colocation** · Kent C. Dodds · blog (2019–2020) · ✅ · R6
https://kentcdodds.com/blog/application-state-management-with-react · https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster
- Separate server cache from UI state.
- Start local; push down to the one child that uses it; lift for siblings; composition before context.
- One context per domain, provided where needed, not all at the root.

### Import boundaries and barrel files

**S48 — eslint-plugin-boundaries** · javierbrea · repo · ✅ · R6
https://github.com/javierbrea/eslint-plugin-boundaries
- Assign element types (app, feature, shared…) to folder patterns and declare allowed dependencies between types.

**S49 — eslint-plugin-import `no-restricted-paths`** · import-js · rule doc · ✅ · R6
https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md
- Zones with `target`/`from`/`except`/`message`; checks resolved paths. The mechanism Bulletproof uses.

**S50 — Please Stop Using Barrel Files** · TkDodo · blog (2024-07) · ✅ · R6
https://tkdodo.eu/blog/please-stop-using-barrel-files
- Barrels cause import cycles and slow dev startup; they don't actually hide internals.
- The only legitimate barrel is a library's package entry point.

**S51 — Speeding up the JavaScript ecosystem: the barrel file debacle** · Marvin Hagemeister · blog (2023-10) · ✅ · R6
https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7/
- Chained barrels pull in the whole module graph; test runners and linters pay that per process.
- A few barrels are fine; one in every folder is the problem.

### Env and testing

**S52 — T3 Env for Next.js** · t3-oss · library doc · ✅ · N4
https://env.t3.gg/docs/nextjs
- One `src/env.ts` with separate `server` and `client` Zod schemas; import it in `next.config` to validate at build time.
- Split into `env/server.ts` + `env/client.ts` if even variable names are sensitive.

**S53 — Testing Library Guiding Principles; Testing Implementation Details** · Testing Library; Kent C. Dodds (2020) · official doc + blog · ✅ · R6
https://testing-library.com/docs/guiding-principles/ · https://kentcdodds.com/blog/testing-implementation-details
- Test what users see: props in, DOM out; internal state and helper names are implementation details.
- Architectural consequence: put branching business rules in plain functions and unit-test them; test components through behaviour; colocate tests.

**Excluded:** https://www.robinwieruch.de/next-folder-structure/ — 404 (superseded by S31).

---

## Where sources disagree — and the stance this skill takes

| Topic | Positions | Skill's stance |
|-------|-----------|----------------|
| Barrel / `index.ts` files | For: Comeau [S32], FSD public API [S28]. Against: Bulletproof [S25], TkDodo [S50], Hagemeister [S51]. Optional: Wieruch [S30] | No `export *` barrels for folders or features. A thin `index.ts` that re-exports **one** component from its folder is allowed. |
| FSD vs Bulletproof | FSD: 6 layers, purpose-named segments, bans `components/`/`hooks/` [S27]. Bulletproof: flat `features/` with type-named subfolders [S25]. Both: one-way deps, no sibling-feature imports | Default to Bulletproof-style `features/` (simpler); FSD is a valid alternative for large apps. Keep the one-way dependency rule either way. |
| `utils/` folders | Kept: Comeau [S32], Bulletproof [S25]. Pushed back: Dodds [S33], FSD [S27], Kettmann [S43] | Shared `utils/`/`lib/` only for single-purpose, domain-free modules. Domain helpers live with their feature. |
| Container / presentational | Outdated: Abramov [S35], patterns.dev [S37], FSD. Revived as view + hook + domain: Qiu [S42] | Use hooks, not container components. Keep the view thin by moving logic into hooks and domain functions. |
| Layering depth | Services, use cases, DI: Qiu [S42], Kettmann [S43], clean architecture [S34]. Let React Query replace boilerplate: Kondov [S41], TkDodo [S45] | Start with view + hook + domain + API layer. Add use-case or service layers only when real logic exists. |
| Split heuristics | Size alone is no reason: Dodds [S38]. More than ~5 props is a signal: Kondov [S41]. Single responsibility: [S1] | Split on responsibility, reuse, state ownership, testability, or prop count. Never split for line count alone. |
| DAL location | `app/lib/dal.ts` [S16], top-level `data/` [S14], `shared/db` [S29], infrastructure [S34] | The path is flexible; the rules are fixed: `server-only`, authorization, DTOs. |
| Validation placement | In the action [S16]; in the action or DAL [S14]; in controllers [S34] | Validate input at the entry point (action or route handler) with a shared Zod schema. The DAL still authorizes. |
| File naming case | Kebab-case: Bulletproof [S25], Wieruch [S30]. PascalCase components: Comeau [S32] | Follow the repo's existing convention, enforced by lint. |

---

## Consensus rules (traceability for SKILL.md)

| # | Rule | Sources |
|---|------|---------|
| C1 | Colocate by default; promote to shared on second use, and demote again when that use goes away | S30, S33, S32, S25 |
| C2 | At scale, organize by feature or domain. Type folders only for truly generic shared code | S25, S27, S41, S30 |
| C3 | Dependencies flow one way (shared → features → app). No imports between sibling features. Enforce with lint | S25, S27, S48, S49 |
| C4 | Components are pure and thin. Side effects go in handlers first, Effects last | S6, S2, S42 |
| C5 | Separate stateful logic with hooks, not container components. `useX` only if it calls hooks | S35, S3, S37 |
| C6 | Business rules are plain TS functions: no React, no fetch, unit-tested | S42, S43, S53 |
| C7 | One API client plus per-resource request functions that return frontend-shaped data | S26, S43, S42 |
| C8 | Server state lives in a server-cache library, wrapped in feature hooks. Never copied into `useState` or a store | S45, S26, S47 |
| C9 | Keep state minimal and local: derive values, store IDs, use a status union, lift to the common parent, try composition before context | S1, S4, S5, S7, S47 |
| C10 | Split components for a reason, not for size. No components or render functions defined inside components | S38, S41, S1 |
| C11 | Avoid hasty abstractions. A growing pile of flags means inline it or invert control | S40, S39 |
| C12 | No dumping-ground `utils/`. Each shared lib has one purpose | S33, S27, S43 |
| C13 | Constants live at the narrowest scope that covers their users: module, then component or feature file, then `config/` | S32, S41, S27 |
| C14 | `@/` alias across features, relative imports inside one. One naming case, enforced by lint | S25, S30 |
| C15 | Test behaviour, not implementation. Tests sit next to the code | S53, S33 |
| C16 | Next: `app/` is thin routing. Use `_private` and `(group)` folders for organization. Pick one structure strategy | S11, S29, S25 |
| C17 | Next: Server by default. `'use client'` only on interactive leaves. Pass server output as `children`. Use `server-only`/`client-only` | S12, S13, S9, S44 |
| C18 | Next: choose one data model. With a DAL it is `server-only`, authorizes, and returns DTOs. Server Components never fetch their own Route Handlers | S14, S15, S16, S18, S23 |
| C19 | Next: Server Actions are thin, public, mutation-only: validate, authorize, DAL, revalidate, then `redirect` outside `try` | S17, S14, S10, S23 |
| C20 | Next: env split by audience, validated in a typed `env.ts`. `NEXT_PUBLIC_*` is a build-time constant | S19, S52 |
| C21 | Next: layouts are shells, not auth gates. Expected errors are returned; unexpected errors throw to `error.tsx`. `metadata` only from Server layouts or pages | S16, S20, S21 |

---

## Maintenance

- Last verified: **2026-11-27** (React 19, Next.js 15.5 in `client/`, docs current as of Next 16.3).
- Link check (last run: 71 URLs, 62 × 200):
  ```sh
  grep -oE 'https://[a-zA-Z0-9./_@#%?=&:~+-]+' README.md | sort -u > urls.txt
  while read -r u; do echo "$(curl -sL -o /dev/null -m 20 -A 'Mozilla/5.0' -w '%{http_code}' "$u") $u"; done < urls.txt
  ```
  Expected non-200: Medium (403, S35), patterns.dev (no response, S37), the excluded Wieruch page (404). GitHub `blob/` URLs may return 503 to curl (bot blocking). Check those with `gh api repos/<owner>/<repo>/contents/<path>` instead; all 5 existed on 2026-11-27.
- On a major version bump, re-check: S22 (release notes), S12/S13 (boundary rules), S17/S18 (actions vs route handlers), S20 (error props), S29 (FSD + Next naming).
