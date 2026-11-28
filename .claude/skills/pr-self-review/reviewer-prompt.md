# Reviewer and verifier prompts

Templates for `pr-self-review`. Replace `{{...}}` before sending. Reviewers run on `sonnet`, the verifier on `opus`. Subagents are general-purpose and read-only: they must not edit files.

## Finding schema (reviewer output)

Return **only** a JSON array (no prose). Empty array if nothing is found.

```json
[
  {
    "skill": "onion-architecture",
    "file": "server/src/modules/x/service.ts",
    "line": 42,
    "rule": "checklist-3 service locator",
    "skillSeverity": "High",
    "severity": "critical | high | medium | low",
    "evidence": "the offending code, <= 200 chars",
    "fix": "one concrete sentence",
    "confidence": 0.0
  }
]
```

`line` is a line in the new file that is inside the diff. `severity` follows `.claude/skills/pr-self-review/severity.md`; `skillSeverity` is the label your skill used.

## Reviewer, full mode

```
You review part of a pull request through ONE skill: {{skill}}.

Read, in this order:
1. .claude/skills/{{skill}}/SKILL.md and, if present, examples.md in that folder
2. AGENTS.md and INSIGHTS.md of the touched package(s): {{packages}}. Package rules win over the skill.
3. .claude/skills/pr-self-review/severity.md

Files to review (only these): {{files}}
Diff: run `git diff {{mergeBase}} -- <file>` per file (working tree vs merge-base).
Signals for your skill from the collector (treat as hints to check, not as findings): {{signals}}

Rules:
- Judge ONLY lines added or changed in the diff. Existing deviations (for example "Known deviations") do not count unless this change makes them worse or copies them.
- Report every violation of your skill's rules, any severity. Map severity with severity.md and keep your skill's own label in skillSeverity.
- Do not report style preferences the skill does not state. No speculation: each finding needs evidence from the diff and confidence in [0,1].
- Do not edit files.

Return only the JSON array described in "Finding schema".
```

## Reviewer, quick mode

Same as full, but replace the rules block with:

```
Rules:
- You look for ONE thing only: {{quickFocus}}. Report only candidates for severity "critical" per severity.md. Ignore everything else, even real issues.
- Judge ONLY lines added or changed in the diff.
- Each finding needs evidence from the diff and a confidence in [0,1].
- Do not edit files.
```

## Verifier (opus), one per critical

```
Try to REFUTE this finding from a pull request review. Assume it may be a false positive.

Finding: {{finding json}}
Diff of the file: `git diff {{mergeBase}} -- {{file}}`

Check:
1. Is the cited line really added or changed by the diff (not pre-existing)?
2. Is the code reachable and the condition real (not test-only, dead, or a placeholder/example value)?
3. Does a package rule (AGENTS.md, INSIGHTS.md) or a documented Known deviation allow this case?
4. Is the severity critical per .claude/skills/pr-self-review/severity.md?

Read the surrounding code. Do not edit files.

Return only JSON: {"verdict": "confirmed" | "refuted", "reason": "<=300 chars", "severity": "critical | high | medium | low"}
Use "refuted" only if you found concrete evidence against the finding; if unsure, "confirmed".
```

Handling: `refuted` -> keep the finding, set severity `high` (or the verifier's lower value) and add `note: "refuted by verifier: <reason>"`. Store the result under `cache.mjs put verify --id <id>`.
