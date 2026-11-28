# e2e: Skills flow

Status: implemented
Date: 2026-11-28

Behaviour, contracts and seed content are defined in the owner spec:
[server/specs/2026-11-28-skills.md](../../../server/specs/2026-11-28-skills.md). UI details: [client/specs/2026-11-28-skills-ui.md](../../../client/specs/2026-11-28-skills-ui.md).

## Size & risk
Medium. Adds a flow and depends on a **server seed change**, which this package's rules treat as a risk trigger (flows 02 and 04 assert seeded values).

## Context & problem
Skills ship with a seeded demo set. The hermetic stack needs one deterministic browser flow proving the section renders, a skill opens, and the agent Skills tab shows the attachments. No LLM is involved.

## Goals & non-goals
Goals
- One read-only flow over the seeded skills.
- Confirm the seed does not disturb flows 02 and 04.

Non-goals
- Create/import/delete journeys: they mutate the DB and the runner has no file chooser or drag-and-drop; covered by component and integration tests.
- Reordering by drag (runner has no hover/drag support).

## Design
New `specs/08-skills.flow.json` (next free number; runs last).

Journey
1. Open `{BASE}/skills`; wait for URL `/skills` and `networkidle`.
2. Wait for text `pr-quality-rubric`, `secret-leakage-gate`, `lethal-trifecta` (seeded cards) and `Add Skill`.
3. Click the `pr-quality-rubric` card; wait for URL `/skills/`.
4. Wait for text `Configuration`; open the **Preview** tab (`find role button/tab --name Preview`), wait for `tab=preview` and the rendered heading `PR Quality Rubric`.
5. Open the **Versions** tab; wait for `Version history`.
6. Navigate to `{BASE}/agents`, open `Security Reviewer`, click the **Skills** tab, wait for `tab=skills` and `3 of 6 enabled`.

Seed dependency (from the owner spec): six skills (one globally disabled), three linked and enabled on Security Reviewer. Names/counts above must match the seed exactly; if the seed changes, update this flow in the same change.

## Affected packages & files
`e2e/specs/08-skills.flow.json`; `e2e/docs/specs/README.md` index; `e2e/README.md` / `docs/` coverage map if one lists flows; no `run.ts` or `lib/assert.ts` change expected; `server/src/db/seed.ts` + `seed-skills.ts` (owned by the server spec); CI path filters in `.github/workflows/e2e-web.yml` should already cover `server/**` and `client/**`, verify.

## Risks & rollback
- **Seed drift** breaks exact-text waits: keep flow text identical to seed constants; run all 8 flows on a fresh DB.
- **Flows 02/04** depend on PR #482, repo order and run cost `$0.014`: the skills seed adds only `skills` / `agent_skills` (and optionally `run_skills`) rows and must not add PRs, repos, runs, or change the first repo, nor agent counts those flows read. Verified by running the full suite.
- **Determinism:** no clock, network or model dependence; selectors are by text/role only.
- Rollback: delete the flow file; revert the seed.

## Test plan
- `./scripts/e2e.sh` (hermetic, alternate ports, fresh seed): all flows 01-08 pass.
- Confirm explicitly that 02 and 04 still pass unchanged.
- Run `08` twice in a row to confirm it is read-only and repeatable.

## Open questions
1. If `run_skills` rows are seeded for the existing run (server spec open question 1), should flow 08 also assert a Stats value (e.g. a findings count), or keep Stats out of e2e? (Plan: out of e2e; covered by integration tests.)
