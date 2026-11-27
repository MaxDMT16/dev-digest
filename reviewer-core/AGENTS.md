# reviewer-core — `@devdigest/reviewer-core`

The review engine: diff → prompt → LLM → grounded findings. Consumed by `server` as TypeScript **source** via the alias `@devdigest/reviewer-core` → `../reviewer-core/src`.

## Stack
TypeScript (ESM) · Zod · `openai` SDK (OpenRouter) · Vitest · **npm** (not pnpm).

## Map
- `src/prompt.ts` — prompt assembly + untrusted-content fencing.
- `src/llm/` — injected `LLMProvider`, structured output (Zod → JSON Schema, parse-with-repair).
- `src/grounding.ts` — mechanical citation gate against the diff.
- `src/review/run.ts` — orchestrates a run; `src/output/` — result shaping. Tests in `test/`.

## Commands
```sh
npm run typecheck
npm test                  # vitest run
```
`npm run build` is only a type-check — the package never emits JS. After changes, also run the server typecheck + unit tests (`cd ../server && pnpm typecheck && pnpm exec vitest run --exclude '**/*.it.test.ts'`).

## Conventions (non-negotiable)
- **Pure:** no DB, GitHub, or filesystem access. The only side effect is the injected `LLMProvider`; keep it mockable.
- **Grounding gate is mandatory:** a finding that doesn't cite a real diff line is dropped. Never trust the model's line references or score — the score is recomputed from surviving findings.
- Untrusted content (diff, PR text) is always fenced with `wrapUntrusted()` + the injection guard; never concatenate it raw into the prompt.
- Tests stub the model (see `test/run.test.ts`); no network or keys.

## Do not touch
- `package-lock.json`: only via `npm install`. Don't mix in pnpm/yarn.
- `node_modules/`.

## Specs & docs
**Spec first** for any change that is medium+ in size OR risk — write `specs/YYYY-MM-DD-<slug>.md` from the template in [specs/README.md](specs/README.md), link it from that README, and get the user's OK before coding. Update its `Status` when done. Skip for small/low-risk work (typo, copy, single-file bugfix, test-only, rename/refactor without behaviour change).
- Medium+ size: new module/route/screen, ≳3 files or ≳150 changed lines, new dependency.
- Medium+ risk (any one is enough): prompt or system-prompt text; grounding gate; untrusted-content fencing / injection guard; findings schema or score; `LLMProvider` / structured-output parsing; default model choice. Any change here also affects `server` — note that in the spec.

**Docs:** runbooks, reports and decision records for this package go in `docs/` — layout and what belongs there in [docs/README.md](docs/README.md). Add or refresh one when you change something it describes.

## Read when
- changing the pipeline, prompt, grounding, or findings shape → [README.md](README.md)
- before a medium+ change → [specs/README.md](specs/README.md) (template); runbooks, reports, ADRs → [docs/README.md](docs/README.md)
- starting non-trivial work here, or after hitting a surprising gotcha → [INSIGHTS.md](INSIGHTS.md) (lessons for this package; filled automatically, may be empty)
- editing reviewer prompts or choosing a model → [../docs/agent-prompts/README.md](../docs/agent-prompts/README.md)
- writing or fixing tests / CI → [../TESTING.md](../TESTING.md)
