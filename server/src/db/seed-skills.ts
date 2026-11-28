import type { SkillSource, SkillType } from '@devdigest/shared';

/**
 * Demo skills (mirrors the Skills Lab design). Descriptions are directive: they
 * say when the agent applies the skill. `linkedToSecurity` lists the order and
 * per-agent enabled flag for the Security Reviewer ("3 of 6 enabled").
 */
export interface SeedSkill {
  name: string;
  description: string;
  type: SkillType;
  source: SkillSource;
  enabled: boolean;
  body: string;
  link: { order: number; enabled: boolean };
}

export const SEED_SKILLS: SeedSkill[] = [
  {
    name: 'pr-quality-rubric',
    description: 'Rubric for evaluating overall PR quality across correctness, tests, and clarity.',
    type: 'rubric',
    source: 'manual',
    enabled: true,
    link: { order: 0, enabled: true },
    body: `# PR Quality Rubric

Evaluate the pull request against the following dimensions. For each, return a finding only when the issue is **worth the author's time** — aim for 5 high-signal findings, not 50.

## Correctness
- Does the change do what the PR description claims?
- Are edge cases (empty input, nulls, concurrency) handled?

## Security
- Any secrets, tokens, or credentials in the diff?
- Untrusted input reaching a sink (SQL, shell, fetch)?

## Tests
- New branches covered by assertions?
- Are tests meaningful (not just snapshot churn)?

## Scope
- Does the diff stay within the stated intent?
- Flag out-of-scope changes separately rather than blocking.`,
  },
  {
    name: 'no-then-chains',
    description: 'House rule: always use async/await instead of promise .then() chains.',
    type: 'convention',
    source: 'extracted',
    enabled: true,
    link: { order: 1, enabled: false },
    body: `# No .then() chains

Report new code that chains \`.then()\` / \`.catch()\` on a promise where \`async\`/\`await\` would read more clearly. Do not report existing untouched lines or callback APIs that have no promise form.`,
  },
  {
    name: 'secret-leakage-gate',
    description: 'Detects sk_live, service_role, and NEXT_PUBLIC-exposed secrets in the diff.',
    type: 'security',
    source: 'community',
    enabled: true,
    link: { order: 2, enabled: true },
    body: `# Secret leakage gate

Report as CRITICAL any added line that contains a live credential:

- Payment keys with a live prefix (for example \`sk_live_\`).
- Database or backend service-role keys.
- Secrets exposed to the browser through a public environment prefix (\`NEXT_PUBLIC_\`).

Quote only the first 4 characters of the value in the rationale.`,
  },
  {
    name: 'lethal-trifecta',
    description: 'Flags PRs combining private data access, untrusted input, and external communication.',
    type: 'security',
    source: 'community',
    enabled: true,
    link: { order: 3, enabled: true },
    body: `# Lethal trifecta

Flag a change when the same code path combines all three:

1. Access to private data (database rows, files, secrets).
2. Exposure to untrusted content (user input, web pages, issue text).
3. A way to communicate externally (HTTP request, email, webhook).

List which of the three components each file contributes.`,
  },
  {
    name: 'phantom-api-gate',
    description: 'Detects imports of functions/modules that do not exist in the repository.',
    type: 'security',
    source: 'imported_file',
    enabled: false,
    link: { order: 4, enabled: false },
    body: `# Phantom API gate

Flag an import or call to a function, method or module that cannot be found in the repository or its declared dependencies. Hallucinated APIs often look plausible; verify the symbol exists before accepting it.`,
  },
  {
    name: 'test-coverage-nudge',
    description: 'Suggests tests when new branches lack coverage.',
    type: 'custom',
    source: 'manual',
    enabled: true,
    link: { order: 5, enabled: false },
    body: `# Test coverage nudge

When the diff adds a conditional branch, an error path or a new exported function without a matching test change, suggest one concrete test case. Use SUGGESTION severity.`,
  },
];
