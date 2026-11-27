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

## Read when
- changing the pipeline, prompt, grounding, or findings shape → [README.md](README.md)
- designing or changing engine behavior → [docs/](docs/README.md) and [specs/](specs/README.md)
- starting non-trivial work here, or after hitting a surprising gotcha → [INSIGHTS.md](INSIGHTS.md) (lessons for this package; filled automatically, may be empty)
- editing reviewer prompts or choosing a model → [../docs/agent-prompts/README.md](../docs/agent-prompts/README.md)
- writing or fixing tests / CI → [../TESTING.md](../TESTING.md)
