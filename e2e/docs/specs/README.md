# e2e design specs

Design specifications for changes to the e2e runner, flows, seed assumptions or the hermetic stack. Written **before** the code for any change that is medium+ in size or risk. The rule (what counts as medium+) lives in [../../CLAUDE.md](../../CLAUDE.md) under "Specs & docs".

This folder holds design specs only. The executable flows stay in [../../specs/](../../specs/) (`NN-name.flow.json`), which the runner reads.

## Naming and status

- File: `YYYY-MM-DD-<kebab-slug>.md`, e.g. `2026-11-27-pr-findings-flow.md`.
- `Status:` `draft` → `approved` (user agreed) → `implemented`, or `superseded` (link the replacement).

## Template

```md
# <Title>

Status: draft
Date: YYYY-MM-DD

## Size & risk
Why this is medium+ (size, and which risk triggers from CLAUDE.md apply).

## Context & problem

## Goals & non-goals

## Design
Journeys covered (which user path each flow asserts), flow file names and run order, seed data the flows rely on, stack/ports changes.

## Affected packages & files
Flows, `run.ts` / `lib/assert.ts`, `scripts/e2e.sh`, `.github/workflows/e2e-web.yml`, server seed data.

## Risks & rollback
Flakiness risks, determinism (no LLM, no clock or network dependence).

## Test plan
Which flows run, how the hermetic stack is verified (`../../../scripts/e2e.sh`).

## Open questions
```

## Index

_None yet._
