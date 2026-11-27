# e2e — `@devdigest/e2e`

Deterministic browser flows for the web app, driven by Vercel `agent-browser` (CDP). No LLM, no API key.

## Stack
`agent-browser` CLI (`npm i -g agent-browser && agent-browser install`) · `tsx` runner `run.ts` · TypeScript · **npm** (not pnpm).

## Map
- `specs/NN-name.flow.json` — one flow per file: a JSON list of `agent-browser` commands. **Here `specs/` means executable test flows, not product specs.**
- `run.ts` — runs flows in order in one shared browser session; `lib/assert.ts` — stdout assertions.

## Commands
```sh
../scripts/e2e.sh         # hermetic (recommended): isolated seeded stack on :5433/:3101/:3100, tears down after
npm test                  # runs against an already-running stack on :3000 (needs ../scripts/dev.sh)
npm run typecheck
```
Prefer the hermetic runner: flows 02/04/05 assume the seeded demo repo is the **only** repo, so `npm test` against a normal dev DB can fail on the wrong repo.

## Conventions
- Flow filenames: `NN-kebab-name.flow.json`, numbered in run order.
- Locators are deterministic only: `--url`, `--text`, `find role|text|label`. **Never** use the AI `chat` command.
- `wait --text` / `wait --url` are the assertions (non-zero exit fails the step). Optional `"assert": { "stdoutIncludes": "…" }`.
- Flows use read-only seeded data (`acme/payments-api`, PR #482); never trigger a model call.

## Do not touch
- `package-lock.json`: only via `npm install`.
- Never `docker compose down -v` to reset the dev DB — it deletes the `devdigest_pgdata` volume with all real repos/reviews.
- `node_modules/`.

## Specs & docs
**Spec first** for any change that is medium+ in size OR risk — write `docs/specs/YYYY-MM-DD-<slug>.md` from the template in [docs/specs/README.md](docs/specs/README.md), link it from that README, and get the user's OK before coding. Update its `Status` when done. Skip for small/low-risk work (typo, copy, single flow tweak, selector fix).
- Medium+ size: new flow or several flows at once, runner rewrite, new CI job, ≳3 files or ≳150 changed lines.
- Medium+ risk (any one is enough): `run.ts` / `lib/assert.ts`; seed data assumptions (flows assume the demo repo is the only repo); `scripts/e2e.sh` ports or teardown; changing the hermetic stack; CI workflow `e2e-web.yml`.
- `specs/` here means executable flows, not design specs — design specs always go in `docs/specs/`.

**Docs:** runbooks, reports and decision records for this package go in `docs/` — layout and what belongs there in [docs/README.md](docs/README.md). Add or refresh one when you change something it describes.

## Read when
- adding or changing a flow, or debugging the runner → [README.md](README.md)
- before a medium+ change → [docs/specs/README.md](docs/specs/README.md) (template); runbooks, reports, coverage map → [docs/README.md](docs/README.md)
- starting non-trivial work here, or after hitting a surprising gotcha → [INSIGHTS.md](INSIGHTS.md) (lessons for this package; filled automatically, may be empty)
- CI behavior (`e2e-web.yml`) → [../TESTING.md](../TESTING.md)
