# server docs

Runbooks, reports and decision records for this package, plus design notes that go beyond `README.md`. Design specs for medium+ changes go in [../specs/](../specs/README.md), not here.

## Layout

Folders are created when the first file lands, not in advance.

- `runbooks/<slug>.md` — step-by-step operations: when to use it, steps, how to verify, how to roll back.
- `reports/YYYY-MM-DD-<slug>.md` — point-in-time findings: incident postmortems, performance, cost, audits.
- `adr/NNNN-<slug>.md` — architecture decisions: context, decision, consequences. Numbered, never renumbered.
- Other design notes: a flat `<topic>.md`, linked from the index below.

## What belongs here

- **Runbooks:** run or roll back a migration; reset the dev DB safely (never `docker compose down -v`); reindex `repo-intel`; rotate API keys.
- **Reports:** incident postmortems; slow-query and performance investigations; review-run cost analysis.
- **ADRs:** module boundaries and the `routes → service → repository` split; adapter choices behind the DI container.

## Index

### Runbooks

_None yet._

### Reports

_None yet._

### ADRs

_None yet._
