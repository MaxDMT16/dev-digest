# onion-architecture — examples

Module tree with rings, then ❌ bad → ✅ good pairs for [SKILL.md](SKILL.md). Sources: [README.md](README.md).

Every ❌ quotes real repo code (path:line as of 2026-11-27; long bodies condensed with `/* … */` and reflowed) unless it says **hypothetical**. Every ✅ is a **proposal**: the target shape for new or touched code, not code that exists today. Don't refactor the ❌ sites as a side effect (SKILL.md → Known deviations).

## Module tree with rings

```
server/src/
├── app.ts                         # COMPOSITION ROOT: buildApp, error handler, registers modules
├── platform/
│   ├── container.ts               # COMPOSITION ROOT: builds adapters, shared repos (agentsRepo, reviewRepo, repoIntel)
│   ├── config.ts                  # boundary: env parsed by Zod EnvSchema → AppConfig
│   ├── errors.ts, resilience.ts   # kernel, no imports: usable from any server ring
│   └── jobs.ts                    # INFRASTRUCTURE: JobRunner (Drizzle + p-queue)
├── vendor/shared/
│   ├── adapters.ts                # PORTS: LLMProvider, GitHubClient, GitClient, CodeIndex, …
│   └── contracts/*.ts             # DOMAIN: Zod contracts + z.infer types (also route schemas)
├── adapters/
│   ├── github/octokit.ts          # INFRASTRUCTURE: implements GitHubClient, withRetry/withTimeout
│   ├── llm/, git/, codeindex/, …  # INFRASTRUCTURE
│   └── mocks.ts                   # test fakes of every port
├── db/schema/*.ts, db/rows.ts     # INFRASTRUCTURE: never imported above the repository
└── modules/
    ├── index.ts                   # COMPOSITION ROOT: module registry
    └── repos/
        ├── routes.ts              # wiring block (composition) + PRESENTATION handlers
        ├── service.ts             # APPLICATION: use cases; declares the store interface it needs
        ├── repository.ts          # INFRASTRUCTURE: Drizzle, row → domain mapping, transactions
        ├── helpers.ts             # DOMAIN: pure rules (parseRepoUrl, isValidRepoRef)
        └── constants.ts           # DOMAIN: literals, job kinds, regexes
reviewer-core/src/                 # DOMAIN (innermost): prompt, grounding, reduce; LLMProvider injected
```

---

## 1. Drizzle in a route → service + repository

❌ `server/src/modules/polling/routes.ts:19-66` (same pattern in `pulls/routes.ts`, `workspace/routes.ts`, `settings/routes.ts`)
```ts
app.post('/repos/:id/poll', { schema: { params: IdParams } }, async (req) => {
  const { workspaceId } = await getContext(container, req);
  const [repo] = await container.db
    .select()
    .from(t.repos)
    .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, req.params.id)));
  if (!repo) throw new NotFoundError('Repo not found');

  const gh = await container.github();
  const pulls = await gh.listPullRequests({ owner: repo.owner, name: repo.name });
  for (const pr of pulls) {
    await container.db.insert(t.pullRequests).values({ /* … */ }).onConflictDoUpdate({ /* … */ });
  }
  await container.db.update(t.repos).set({ lastPolledAt: new Date() }).where(eq(t.repos.id, repo.id));
  // …
});
```
Presentation reaches two rings down (infrastructure) and orchestrates the use case itself.

✅ proposal
```ts
// routes.ts — handler only parses, delegates, returns
app.post('/repos/:id/poll', { schema: { params: IdParams } }, async (req) => {
  const { workspaceId } = await getContext(app.container, req);
  return service.poll(workspaceId, req.params.id);
});

// service.ts — use case in domain terms (PrMeta is a shared contract type)
async poll(workspaceId: string, repoId: string) {
  const repo = await this.deps.repos.getById(workspaceId, repoId);
  if (!repo) throw new NotFoundError('Repo not found');
  const pulls = await (await this.deps.github()).listPullRequests({ owner: repo.owner, name: repo.name });
  await this.deps.pulls.syncFromGitHub(workspaceId, repo.id, pulls); // one repository method, one transaction
  return { synced: pulls.length, reviewTriggered: false };
}
```
Model for the file split: `modules/repos/` (routes → service → repository). Not a model for its DI — see §2.

---

## 2. `Container` as service locator → narrow deps, wired once

❌ `server/src/modules/repos/service.ts:29-34` and `repos/routes.ts:21` (same in `agents/service.ts:51-56`, `reviews/service.ts:28-37`)
```ts
export class RepoService {
  private repo: RepoRepository;
  constructor(private container: Container) {
    this.repo = new RepoRepository(container.db);   // service builds its own infrastructure
  }
// routes.ts
  const service = new RepoService(app.container);
```
The real dependency list (`db`, `jobs`, `git`) is hidden. Tests must fake the whole container — `test/agents-versions.it.test.ts:167`:
```ts
const service = new AgentsService({ db } as unknown as Container);
```

✅ proposal
```ts
// service.ts — application declares what it needs, in domain types
export interface ReposStore {
  findByFullName(workspaceId: string, fullName: string): Promise<Repo | undefined>;
  getById(workspaceId: string, id: string): Promise<Repo | undefined>;
  insert(values: NewRepo): Promise<Repo>;
}
export interface RepoServiceDeps {
  repos: ReposStore;
  jobs: Pick<JobRunner, 'enqueue' | 'register'>;
  git: GitClient;
}
export class RepoService {
  constructor(private readonly deps: RepoServiceDeps) {}
}

// routes.ts — wiring block: the only Container reads in this module, runs once at registration
export default async function reposRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const c = app.container;
  const service = new RepoService({ repos: new RepoRepository(c.db), jobs: c.jobs, git: c.git });
  // …handlers call service.* only
}
```
- Secret-backed ports are async and may throw `ConfigError`: inject `github: () => c.github()`, `llm: (id) => c.llm(id)`, not the resolved client.
- A repository shared across modules comes from its `Container` getter in the wiring block (`c.agentsRepo`), never from `import { AgentsRepository } from '../agents/repository.js'` inside another module.
- `Pick<Container, 'git' | 'jobs'>` is only a migration step when you are already reworking an **existing** service's constructor. New services take the explicit deps object above.

### 2b. Adding a method to a service that already takes `Container`

❌ growing the locator (what agents did in the baseline runs)
```ts
async syncLabels(workspaceId: string, repoId: string) {
  const gh = await this.container.github();                         // new hidden dependency
  await new LabelsRepository(this.container.db).replaceAll(/* … */); // new `new` inside the service
}
```

✅ proposal — the new method gets narrow deps; the existing constructor stays as it is
```ts
export interface LabelSyncDeps { repos: ReposStore; labels: LabelsStore; github: () => Promise<GitHubClient> }

export class RepoService {
  constructor(private container: Container, private labelSync?: LabelSyncDeps) { /* existing body unchanged */ }

  async syncLabels(workspaceId: string, repoId: string) {
    if (!this.labelSync) throw new ConfigError('label sync is not wired');
    const { repos, labels, github } = this.labelSync;   // only these; no this.container reads
    // …
  }
}

// routes.ts wiring block
const service = new RepoService(c, {
  repos: new RepoRepository(c.db), labels: new LabelsRepository(c.db), github: () => c.github(),
});
```
Equally fine: a sibling class (`LabelSyncService`) with narrow deps, wired in the same block. Either way the new method is testable with fakes and no `Container` cast.

---

## 3. Row types as the domain model → mapping inside the repository

❌ `server/src/modules/repos/repository.ts:10, 32` — the repository exports its row type and returns it to the service
```ts
export type RepoRow = typeof t.repos.$inferSelect;
  async list(workspaceId: string): Promise<RepoRow[]> {
```
❌ `server/src/modules/repos/helpers.ts:2, 109` (doc comment on 108) — so a pure domain file depends on the DB schema
```ts
import * as t from '../../db/schema.js';
/** Map a persisted repo row to the API `Repo` DTO. */
export function toRepoDto(row: typeof t.repos.$inferSelect): Repo {
```
❌ `server/src/modules/reviews/run-executor.ts:5, 60-63` — application signature typed by a table
```ts
import * as schema from '../../db/schema.js';
async executeRuns(
  workspaceId: string,
  pull: PullRow,
  repo: typeof schema.repos.$inferSelect,
```
Add a column or rename one and the domain, the executor and the DTO all change with the schema.

✅ proposal
```ts
// repository.ts — the row type and its mapper stay here
type RepoRow = typeof t.repos.$inferSelect;          // not exported
function toRepo(row: RepoRow): Repo { /* field mapping */ }

export class RepoRepository implements ReposStore {
  async getById(workspaceId: string, id: string): Promise<Repo | undefined> {
    const [row] = await this.db.select().from(t.repos).where(/* … */);
    return row ? toRepo(row) : undefined;
  }
}
```
- Domain type choice (pragmatic): reuse the shared contract (`Repo`, `Agent`) when it fits; otherwise declare a small module type in `types.ts` or at the top of `service.ts`. No rich entities required.
- A helper that needs a "row-like" input declares its own interface, as `settings/helpers.ts` does (`interface SettingsRow { key: string; value: unknown }`, no schema import).

---

## 4. Manual `parse` in the handler → schema-first route

❌ `server/src/modules/reviews/routes.ts:27-32` (the `app.post` call starts at line 27, the `parse` is at line 32)
```ts
app.post(
  '/pulls/:id/review',
  { schema: { params: IdParams }, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
  async (req) => {
  const { workspaceId } = await getContext(container, req);
  const body = RunRequest.parse(req.body ?? {});
```

✅ proposal for **new** routes
```ts
app.post(
  '/pulls/:id/review',
  { schema: { params: IdParams, body: RunRequest.default({}) }, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
  async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.runReview(workspaceId, req.params.id, req.body, req.log); // service sees only its Logger type
  },
);
```
Caveat: the comment at `reviews/routes.ts:26` says the manual parse is deliberate (empty body allowed). Before switching this existing route, prove with `app.inject()` that an omitted body and `{}` still pass. New routes start schema-first.

---

## 5. Application imports a concrete adapter → pure code moves inward

❌ `server/src/modules/reviews/diff-loader.ts:1-5, 12-18`
```ts
import type { Container } from '../../platform/container.js';
import { parseUnifiedDiff } from '../../adapters/git/diff-parser.js';
import * as schema from '../../db/schema.js';
export async function loadDiff(
  container: Container,
  repo: ReviewRepository,
  workspaceId: string,
  pull: PullRow,
  repoRow: typeof schema.repos.$inferSelect,
): Promise<UnifiedDiff> {
```
Three outward edges in one file: the container, a concrete adapter folder, the DB schema.

✅ proposal
```ts
// parseUnifiedDiff has no I/O, so it is domain code living in the wrong folder.
// New pure code goes to a pure location (module helpers.ts, or reviewer-core if the engine needs it);
// the adapter then imports it from there, never the other way round.
export async function loadDiff(
  deps: { git: GitClient; prFiles: PrFilesStore },
  pull: PullRef,                     // domain type: { id, base, headSha }
  repo: RepoRef,                     // from adapters.ts
): Promise<UnifiedDiff> { /* … */ }
```
Don't move `diff-parser.ts` as part of an unrelated task (it is imported by `simple-git.ts`, `mocks.ts`, `test/grounding.test.ts`).

---

## 6. SDK in a service → port method in domain terms

❌ **hypothetical** — modelled on the planted violation in the baseline review test (Octokit + `process.env` + Drizzle inside a service); a reviewer without this skill rated it only "Major, convention"
```ts
import { Octokit } from 'octokit';
export class LabelsService {
  async sync(repo: RepoRow) {
    const gh = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const { data } = await gh.rest.issues.listLabelsForRepo({ owner: repo.owner, repo: repo.name });
    await this.container.db.insert(t.repoLabels).values(/* … */);
  }
}
```
Five High findings: SDK in the application ring, a secret read outside `SecretsProvider`, SDK types (`data`) in the use case, Drizzle in the service, `this.container` as a service locator. The row type `RepoRow` in the signature is a sixth (checklist 4).

✅ proposal (three short edits)
```ts
// 1. server/src/vendor/shared/adapters.ts — port, domain types only (check the client copy too)
export interface GitHubClient {
  // …existing methods
  listLabels(repo: RepoRef): Promise<{ name: string; color: string }[]>;
}

// 2. server/src/adapters/github/octokit.ts — SDK, retry/timeout and mapping stay here
async listLabels(repo: RepoRef) {
  return withRetry(() =>
    withTimeout(
      (async () => {
        const res = await this.octokit.rest.issues.listLabelsForRepo({ owner: repo.owner, repo: repo.name });
        return res.data.map((l) => ({ name: l.name, color: l.color })); // SDK type ends here
      })(),
      TIMEOUT,
    ),
  );
}

// 3. server/src/adapters/mocks.ts — MockGitHubClient gets a canned listLabels()

// service.ts
async syncLabels(workspaceId: string, repoId: string) {
  const repo = await this.deps.repos.getById(workspaceId, repoId);
  if (!repo) throw new NotFoundError('Repo not found');
  const labels = await (await this.deps.github()).listLabels({ owner: repo.owner, name: repo.name });
  await this.deps.labels.replaceAll(repoId, labels);
}
```
Adding a port method is a DI/adapter change: spec first (server/AGENTS.md).

---

## 7. Non-atomic multi-statement write → one repository method with a transaction

❌ `server/src/modules/pulls/routes.ts:186-223` — in a route, and not atomic: a failure after the `delete` leaves the PR with no files
```ts
const gh = await container.github();
const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, pr.number);
await container.db.delete(t.prFiles).where(eq(t.prFiles.prId, pr.id));
if (detail.files.length > 0) {
  await container.db.insert(t.prFiles).values(detail.files.map(/* … */));
}
await container.db.delete(t.prCommits).where(eq(t.prCommits.prId, pr.id));
// … insert commits, update pull_requests
```

✅ proposal — the repository owns the transaction [S20]
```ts
// repository.ts
async replaceDetail(prId: string, detail: PrDetail): Promise<void> {
  await this.db.transaction(async (tx) => {
    await tx.delete(t.prFiles).where(eq(t.prFiles.prId, prId));
    if (detail.files.length > 0) await tx.insert(t.prFiles).values(detail.files.map(toPrFileRow(prId)));
    await tx.delete(t.prCommits).where(eq(t.prCommits.prId, prId));
    // … commits, pull_requests update
  });
}
```
When one use case must commit writes of **several** repositories together, add a port instead of passing `tx` through the service (**proposal**; no such port exists yet) [S8]:
```ts
// application declares it
export interface UnitOfWork {
  withTransaction<T>(fn: (stores: { pulls: PullsStore; reviews: ReviewsStore }) => Promise<T>): Promise<T>;
}
// infrastructure implements it with db.transaction and tx-bound repositories; tests use a pass-through fake
```

---

## 8. Service test through a fake container → fakes of its ports

❌ `server/test/agents-versions.it.test.ts:167` and `server/test/indexer-pipeline.test.ts:131-137`
```ts
const service = new AgentsService({ db } as unknown as Container);

function makeContainer(git: MiniGit): Container {
  return { git, depgraph: { buildEdges: async () => [] }, tokenizer: { /* … */ } } as unknown as Container;
}
```
The cast hides which deps are used; a new `this.container.x` in the service compiles and fails only at runtime. A pure use-case test now needs Postgres.

✅ proposal
```ts
import type { Repo } from '@devdigest/shared';
import { MockGitClient } from '../src/adapters/mocks.js';

const repo: Repo = { id: 'r1', workspace_id: 'ws1', owner: 'acme', name: 'api', full_name: 'acme/api',
  default_branch: 'main', clone_path: null, last_polled_at: null, created_by: 'u1' }; // Repo contract, platform.ts
const enqueued: unknown[] = [];
const service = new RepoService({
  repos: {                                                   // in-memory store, no Postgres
    findByFullName: async () => undefined,
    getById: async () => undefined,
    insert: async (v) => ({ ...repo, name: v.name, owner: v.owner }),
  },
  jobs: {
    enqueue: async (_ws, _kind, p) => { enqueued.push(p); return { id: 'j1', done: Promise.resolve() }; },
    register: () => {},
  },
  git: new MockGitClient(),
});
await service.add('ws1', 'u1', 'https://github.com/acme/api');
expect(enqueued).toHaveLength(1);
```
Keep `*.it.test.ts` + `test/helpers/pg.ts` for the repository itself, and `buildApp({ overrides })` + `app.inject()` for the route.
