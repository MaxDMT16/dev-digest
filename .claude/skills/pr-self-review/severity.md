# Severity scale

One scale for every source (checks, repo rules, each skill). Every finding keeps both `skillSeverity` (what the skill itself called it) and `severity` (this scale). Only **critical** blocks the gate.

## critical

After merge, security, data, a contract, or the Dependency Rule breaks.

- `typecheck` or test failure (`checks`).
- A do-not-touch file changed (`.env*`).
- security: exploitable CRITICAL or HIGH; a committed secret.
- onion-architecture: checklist items 1-5 (`onion-architecture/SKILL.md`, "Review checklist").
- Destructive or irreversible migration.
- `vendor/shared` contract broken for the other package's copy.
- Guaranteed runtime bug: rules of hooks, server-only code or secrets in a client component, a `key` bug that loses state.

## high (does not block)

- react-best-practices CRITICAL that is only about maintainability.
- onion-architecture items 6-10.
- frontend-architecture findings.
- `high` rules from `rules.mjs` (vendored skill modified, lock without package.json, cross-package import without CI `paths:`, spec-first).

## medium / low

Everything else. `medium`: likely worth fixing in this PR. `low`: nit or optional.

## Mapping by source

| Source | Their level | Unified |
|--------|-------------|---------|
| checks | typecheck/test fails | critical |
| repo-rules | do-not-touch-env, secret-in-diff | critical (secret needs verification) |
| repo-rules | vendored-skill-modified, lock-without-package-json, cross-package-without-ci-paths, spec-first | high |
| repo-rules | conventional-commits | medium |
| security | CRITICAL / HIGH exploitable | critical |
| security | HIGH not exploitable here, MEDIUM | high / medium |
| onion-architecture | items 1-5 (High) | critical |
| onion-architecture | items 6-10 (Medium) | high |
| frontend-architecture | any | high |
| react-best-practices | CRITICAL guaranteed bug | critical |
| react-best-practices | CRITICAL maintainability | high |
| react-best-practices | HIGH / MEDIUM / LOW | medium / low |
| next-best-practices | server-only code in a client component | critical |
| drizzle-orm-patterns, postgresql-table-design | destructive migration, data loss | critical |
| zod | broken contract between vendor/shared copies | critical |
| others (fastify, typescript-expert, react-testing-library, ...) | any | medium or low |

When unsure between two levels, pick the lower one: a wrong critical blocks the user, and critical LLM findings are verified by a second model anyway.
