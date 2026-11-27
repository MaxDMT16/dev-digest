# reviewer-core specs

Feature and contract specifications for this package, written **before** the code for any change that is medium+ in size or risk. The rule (what counts as medium+) lives in [../CLAUDE.md](../CLAUDE.md) under "Specs & docs".

## Naming and status

- File: `YYYY-MM-DD-<kebab-slug>.md`, e.g. `2026-11-27-grounding-line-tolerance.md`.
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
Pipeline stages affected, prompt changes (quote the before/after), findings shape and score, grounding rules, `LLMProvider` contract.

## Affected packages & files
Say explicitly if `server` is affected (it type-checks against this source).

## Risks & rollback

## Test plan
Stubbed-model tests (`test/run.test.ts` style), grounding and injection cases, server typecheck and unit tests.

## Open questions
```

## Index

_None yet._
