# client docs

Runbooks, reports and decision records for this package, plus design notes that go beyond `README.md`. Design specs for medium+ changes go in [../specs/](../specs/README.md), not here.

## Layout

Folders are created when the first file lands, not in advance.

- `runbooks/<slug>.md` — step-by-step operations: when to use it, steps, how to verify, how to roll back.
- `reports/YYYY-MM-DD-<slug>.md` — point-in-time findings: audits, performance, UX reviews.
- `adr/NNNN-<slug>.md` — architecture decisions: context, decision, consequences. Numbered, never renumbered.
- Other design notes: a flat `<topic>.md`, linked from the index below.

## What belongs here

- **Runbooks:** add a locale (`messages/<locale>/`); add a route or screen (route map, `_components/`, e2e flow); update the vendored `@devdigest/ui` copy.
- **Reports:** accessibility audits; bundle size and Lighthouse performance; UX reviews of the review and findings surfaces.
- **ADRs:** data fetching and state (TanStack Query, the single `src/lib/api.ts` client); component structure and colocation.

## Index

### Runbooks

_None yet._

### Reports

_None yet._

### ADRs

_None yet._
