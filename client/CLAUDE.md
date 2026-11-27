# client — `@devdigest/web`

The DevDigest studio UI: repos, pull requests, reviews, agents, settings. Port 3000.

## Stack
Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 4 · TanStack Query · `next-intl` · Zod · Vitest + React Testing Library + jsdom · **pnpm**.

## Map
- `src/app/**/page.tsx` — routes (`repos`, `agents`, `settings`, `onboarding`). Pages are thin; feature logic sits in colocated `_components/<Name>/` folders, each with its own `*.test.tsx`.
- `src/lib/api.ts` — the only API client (base `NEXT_PUBLIC_API_BASE`, default `http://localhost:3001`); every data hook is in `src/lib/hooks/*`.
- `src/components/` — cross-cutting UI (app-shell, diff-viewer, …). `messages/<locale>/*.json` — i18n strings.
- `src/vendor/ui` (`@devdigest/ui`) and `src/vendor/shared` (`@devdigest/shared`) — vendored.

## Commands
```sh
pnpm dev                  # :3000 (needs the API on :3001 — ./scripts/dev.sh from root)
pnpm typecheck
pnpm test                 # vitest + jsdom, fetch mocked — no API/browser needed
pnpm build
```
Before finishing: `pnpm typecheck && pnpm test`.

## Conventions
- Component folders are `PascalCase/` with an `index.ts` barrel; hooks go in `src/lib/hooks/<area>.ts`; route-private UI goes in the route's `_components/`.
- Fetch data only through hooks → `src/lib/api.ts`; no ad-hoc `fetch` in components.
- User-visible strings go through `next-intl` messages, not hard-coded literals.
- Tests mock `fetch`; query by role/label/text (RTL), not by implementation details.
- Shared types come from `@devdigest/shared` Zod contracts. Its copy here differs from `server/src/vendor/shared` — check the server's copy when a contract changes.

## Do not touch
- `src/vendor/ui/**` — vendored primitives; don't edit to fit a feature.
- `pnpm-lock.yaml`: only via `pnpm add/remove`. Don't mix in npm/yarn.
- `.next/`, `node_modules/`, `.env`, `next-env.d.ts`.

## Specs & docs
**Spec first** for any change that is medium+ in size OR risk — write `specs/YYYY-MM-DD-<slug>.md` from the template in [specs/README.md](specs/README.md), link it from that README, and get the user's OK before coding. Update its `Status` when done. Skip for small/low-risk work (typo, copy, single-file bugfix, test-only, rename/refactor without behaviour change).
- Medium+ size: new module/route/screen, ≳3 files or ≳150 changed lines, new dependency.
- Medium+ risk (any one is enough): shared Zod contract consumed from `@devdigest/shared`; `src/lib/api.ts` or data hooks/caching (TanStack Query keys); routing/layout (app-shell); i18n message structure; review/findings surfaces.

**Docs:** runbooks, reports and decision records for this package go in `docs/` — layout and what belongs there in [docs/README.md](docs/README.md). Add or refresh one when you change something it describes.

## Read when
- adding or changing a route/screen → [README.md](README.md) (route map)
- before a medium+ change → [specs/README.md](specs/README.md) (template); runbooks, reports, ADRs → [docs/README.md](docs/README.md)
- starting non-trivial work here, or after hitting a surprising gotcha → [INSIGHTS.md](INSIGHTS.md) (lessons for this package; filled automatically, may be empty)
- API shape questions → [../server/README.md](../server/README.md)
- writing or fixing tests / CI → [../TESTING.md](../TESTING.md)
