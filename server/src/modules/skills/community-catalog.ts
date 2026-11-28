import type { CommunitySkill, CommunitySkillDetail, SkillType } from '@devdigest/shared';

/**
 * Curated, static community catalog. No outbound requests: entries are bundled
 * with the server and still go through preview → confirm → saved disabled.
 */
interface CatalogEntry extends CommunitySkill {
  type: SkillType;
  body: string;
}

const CATALOG: CatalogEntry[] = [
  {
    slug: 'owasp-top-10-review',
    name: 'owasp-top-10-review',
    repo: 'secdev/agent-skills',
    stars: 1240,
    lang: 'any',
    desc: 'Maps diff changes to the OWASP Top 10 with CWE references.',
    tags: ['security'],
    type: 'security',
    body: `# OWASP Top 10 review

Flag a changed line only when it introduces or worsens one of these classes. Cite the CWE in the rationale.

- Broken access control (CWE-284): a new route or query skips an ownership or role check.
- Injection (CWE-89, CWE-78): untrusted input reaches SQL, a shell or an interpreter without parameterisation.
- Cryptographic failures (CWE-327): weak hashes, hard-coded keys, plaintext secrets.
- Security misconfiguration (CWE-16): debug flags, permissive CORS, default credentials.

Do not report theoretical issues without a reachable path in the diff.`,
  },
  {
    slug: 'react-hooks-rules',
    name: 'react-hooks-rules',
    repo: 'frontend-guild/skills',
    stars: 842,
    lang: 'TypeScript',
    desc: 'Detects conditional hooks, missing deps, stale closures.',
    tags: ['performance'],
    type: 'convention',
    body: `# React hooks rules

Check changed components for:

- Hooks called conditionally, in loops or after an early return.
- Effect, memo and callback dependency arrays that omit a value used inside.
- State updates that read a stale closure; prefer the functional form.
- Effects that subscribe without a cleanup function.`,
  },
  {
    slug: 'sql-injection-gate',
    name: 'sql-injection-gate',
    repo: 'secdev/agent-skills',
    stars: 690,
    lang: 'any',
    desc: 'Flags string-concatenated SQL and unparameterized queries.',
    tags: ['security'],
    type: 'security',
    body: `# SQL injection gate

Report a finding when a query string is built by concatenation or template interpolation of a value that can originate outside the process (request, file, message queue).

Accept parameterised queries and query builders. Treat identifiers (table, column names) interpolated from user input as a finding unless checked against an allow-list.`,
  },
  {
    slug: 'a11y-jsx-audit',
    name: 'a11y-jsx-audit',
    repo: 'a11y-collective/skills',
    stars: 318,
    lang: 'TypeScript',
    desc: 'Checks JSX for missing alt text, ARIA, and focus traps.',
    tags: ['accessibility'],
    type: 'rubric',
    body: `# Accessibility audit for JSX

For each changed element check:

- Images have meaningful alt text (an empty alt only for decorative images).
- Interactive elements are reachable by keyboard and have an accessible name.
- ARIA roles match the element's behaviour; no redundant roles.
- Modals trap and restore focus.`,
  },
  {
    slug: 'n-plus-one-queries',
    name: 'n-plus-one-queries',
    repo: 'perf-lab/skills',
    stars: 507,
    lang: 'any',
    desc: 'Finds N+1 query patterns and missing indexes in data access code.',
    tags: ['performance'],
    type: 'rubric',
    body: `# N+1 and indexing

Flag loops that issue one query per item when a single batched query would do. Flag new filters or joins on columns that have no index in the same change. Quote the loop and the query in the rationale.`,
  },
  {
    slug: 'test-quality-bar',
    name: 'test-quality-bar',
    repo: 'quality-guild/skills',
    stars: 264,
    lang: 'any',
    desc: 'Rubric for meaningful tests: assertions, edge cases, no snapshot churn.',
    tags: ['quality'],
    type: 'rubric',
    body: `# Test quality bar

New branches need an assertion that fails if the branch is removed. Prefer behaviour assertions over snapshots. Ask for a test of the empty, null and error paths when the diff adds them.`,
  },
];

export function searchCommunity(q?: string, lang?: string, tag?: string): CommunitySkill[] {
  const needle = q?.trim().toLowerCase();
  return CATALOG.filter((e) => {
    if (lang && lang !== 'all' && e.lang !== 'any' && e.lang.toLowerCase() !== lang.toLowerCase()) {
      return false;
    }
    if (tag && !e.tags.includes(tag.toLowerCase())) return false;
    if (!needle) return true;
    return (
      e.name.toLowerCase().includes(needle) ||
      e.desc.toLowerCase().includes(needle) ||
      e.tags.some((t) => t.includes(needle))
    );
  })
    .sort((a, b) => b.stars - a.stars)
    .map(({ type: _type, body: _body, ...rest }) => rest);
}

export function getCommunityDetail(slug: string): CommunitySkillDetail | undefined {
  return CATALOG.find((e) => e.slug === slug);
}
