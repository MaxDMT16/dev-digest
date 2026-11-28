# client specs

Feature and contract specifications for this package, written **before** the code for any change that is medium+ in size or risk. The rule (what counts as medium+) lives in [../CLAUDE.md](../CLAUDE.md) under "Specs & docs".

## Naming and status

- File: `YYYY-MM-DD-<kebab-slug>.md`, e.g. `2026-11-27-findings-severity-filter.md`.
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
Routes and screens, data hooks and query keys, shared contracts from `@devdigest/shared`, i18n keys.

## Affected packages & files

## Risks & rollback

## Test plan
Component / hook tests (RTL + jsdom) and e2e flows: what is covered, and what is deliberately not.

## Open questions
```

## Index

- [2026-11-28 — Skills UI: section, editor, import, agent Skills tab](2026-11-28-skills-ui.md) — `implemented` (contracts and behaviour: [server spec](../../server/specs/2026-11-28-skills.md))
