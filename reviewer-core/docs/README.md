# reviewer-core docs

Runbooks, reports and decision records for this package, plus design notes that go beyond `README.md`. Design specs for medium+ changes go in [../specs/](../specs/README.md), not here. Reviewer prompts and model choice are documented in [../../docs/agent-prompts/](../../docs/agent-prompts/README.md).

## Layout

Folders are created when the first file lands, not in advance.

- `runbooks/<slug>.md` — step-by-step operations: when to use it, steps, how to verify, how to roll back.
- `reports/YYYY-MM-DD-<slug>.md` — point-in-time findings: evals, injection-test results, cost and latency.
- `adr/NNNN-<slug>.md` — architecture decisions: context, decision, consequences. Numbered, never renumbered.
- Other design notes: a flat `<topic>.md`, linked from the index below.

## What belongs here

- **Runbooks:** debug a bad or empty review (parse-with-repair failures, grounding drops); switch the model.
- **Reports:** prompt or model evals (precision, grounding-drop rate, cost and latency); prompt-injection test results.
- **ADRs:** the grounding gate rules; how the score is recomputed from surviving findings; the untrusted-content fencing approach.
- **Prompt changelog:** when a prompt changes, record what changed and why (as a report or an ADR amendment).

## Index

### Runbooks

_None yet._

### Reports

_None yet._

### ADRs

_None yet._
