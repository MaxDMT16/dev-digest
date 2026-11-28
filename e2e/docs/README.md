# e2e docs

Runbooks, reports and decision records for the browser e2e suite, plus design notes that go beyond `README.md`. Executable flows stay in [../specs/](../specs/) (`NN-name.flow.json`). Design specs for medium+ changes go in [specs/](specs/README.md).

## Layout

Folders are created when the first file lands, not in advance.

- `specs/YYYY-MM-DD-<slug>.md` — design specs, written before a medium+ change. See [specs/README.md](specs/README.md).
- `runbooks/<slug>.md` — step-by-step operations: when to use it, steps, how to verify, how to roll back.
- `reports/YYYY-MM-DD-<slug>.md` — point-in-time findings: flaky-flow triage, CI failure analysis.
- `adr/NNNN-<slug>.md` — decisions: context, decision, consequences. Numbered, never renumbered.
- Other notes: a flat `<topic>.md`, linked from the index below.

## What belongs here

- **Runbooks:** run the hermetic stack (`../../scripts/e2e.sh`); debug a failing flow; update the seed data the flows rely on.
- **Reports:** flaky-flow triage; CI failure analysis for `e2e-web.yml`.
- **Coverage map:** which user journeys the flows cover, and which are deliberately not covered. Keep it current when a flow is added or removed.

## Index

### Runbooks

_None yet._

### Reports

_None yet._

### Coverage map

_None yet._

### ADRs

_None yet._
