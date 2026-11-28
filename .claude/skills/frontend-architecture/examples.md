# frontend-architecture — examples

Folder trees and ❌ bad → ✅ good pairs for [SKILL.md](SKILL.md). Sources: [README.md](README.md).

## Folder trees

### Route-colocated (modelled on DevDigest `client/`; good up to medium apps)

```
src/
├── app/
│   ├── layout.tsx
│   ├── agents/
│   │   ├── page.tsx                      # thin Server page → renders <AgentsListView/>
│   │   └── _components/AgentsListView/   # 'use client' view + its constants/helpers/styles
│   └── repos/[repoId]/pulls/
│       ├── page.tsx
│       ├── helpers.ts                    # route-level: used by several components below
│       ├── constants.ts
│       └── _components/
│           ├── FilterBar/
│           ├── PRRow/
│           └── PrFindingsCell/
│               ├── PrFindingsCell.tsx
│               ├── PrFindingsCell.test.tsx
│               ├── index.ts              # export { PrFindingsCell } from './PrFindingsCell'
│               ├── constants.ts          # only when it has constants
│               ├── helpers.ts            # only when it has helpers
│               └── hooks/                # only when it has UI hooks
├── components/                           # cross-route UI (app-shell, run-cost-badge)
└── lib/
    ├── api.ts                            # the one API client
    ├── hooks/reviews.ts                  # React Query hooks per resource
    └── findings.ts                       # domain helpers shared by 2+ routes
```

### Feature-based (larger apps) with a thin `app/`

```
src/
├── app/(dashboard)/reviews/[id]/page.tsx   # imports from features/, composes them
├── features/
│   ├── reviews/
│   │   ├── api/get-review.ts             # fetcher + query hook + schema
│   │   ├── components/ReviewPanel.tsx
│   │   ├── domain/review.ts              # isReviewStale(), no React
│   │   └── server/{data.ts,actions.ts}   # 'server-only' DAL, 'use server' actions
│   └── runs/                             # never imports from features/reviews
├── components/ui/                        # generic UI kit
├── lib/                                  # api client, env.ts, single-purpose libs
└── config/                               # app-wide constants
```

---

## 1. Business logic in the component → domain function + hook

❌
```tsx
function ReviewRow({ review }: { review: Review }) {
  const stale =
    review.status !== 'accepted' &&
    Date.now() - new Date(review.createdAt).getTime() > 7 * 24 * 3600 * 1000;
  return <Row muted={stale}>{review.title}</Row>;
}
```

✅
```ts
// domain (plain TS, unit-tested without rendering)
const STALE_AFTER_MS = 7 * 24 * 3600 * 1000;
export const isReviewStale = (r: Review, now = Date.now()) =>
  r.status !== 'accepted' && now - Date.parse(r.createdAt) > STALE_AFTER_MS;
```
```tsx
function ReviewRow({ review }: { review: Review }) {
  return <Row muted={isReviewStale(review)}>{review.title}</Row>;
}
```

## 2. Copying server data into state → select from the cache

❌
```tsx
const { data: repos } = useRepos();
const [selected, setSelected] = useState<Repo | null>(null);   // stale copy
useEffect(() => { if (repos) setSelected(repos[0]); }, [repos]);
```

✅
```tsx
const [selectedId, setSelectedId] = useState<string | null>(null); // store the ID
const { data: selected } = useQuery({
  queryKey: ['repos'],
  queryFn: api.getRepos,
  select: (repos) => repos.find((r) => r.id === selectedId) ?? repos[0], // derived, never stored
});
```
A context may also expose `activeRepo` derived from the query on each render. Only the ID lives in state.

## 3. Dumping-ground utils → topic modules with owners

❌
```
src/utils/helpers.ts   // formatDate, countBySeverity, mapApiRun, debounce, isAdmin …
```

✅
```
src/lib/format-usage.ts                    # one topic: cost/token display (the single source for it)
src/lib/findings.ts                        # countBySeverity: domain, shared by 2 routes
app/.../RunTraceDrawer/helpers.ts          # helpers used only by RunTraceDrawer
```
A new shared formatter for another topic (durations) gets its own file, e.g. `src/lib/format-duration.ts`. It doesn't go into `format-usage.ts`.

## 4. Constants at the wrong level

❌ `src/constants.ts` holding `MAX_VISIBLE_FINDINGS` that only `FindingsPanel` uses.

✅
```ts
// FindingsPanel.tsx: one consumer, so module-level and not exported
// (or FindingsPanel/constants.ts if that is the folder convention)
const MAX_VISIBLE_FINDINGS = 50;
```
❌ The same list redeclared in each component, as `client/` does today: `RunHistory.tsx`, `PrFindingsCell.tsx`, and a rank map in `FindingsPanel/constants.ts`:
```ts
const SEVERITY_ORDER: Severity[] = ["CRITICAL", "WARNING", "SUGGESTION"];
```
✅ Target: promote it to a domain module once several routes need it, and import it from there:
```ts
// src/lib/findings.ts
export const SEVERITY_ORDER = ['CRITICAL', 'WARNING', 'SUGGESTION'] as const satisfies readonly Severity[];
```

## 5. Render functions and boolean props → components and composition

❌
```tsx
function PrCard({ pr, compact, showCost, showFindings, highlightCritical }: Props) {
  const renderBadge = (s: Severity) => <span className={…}>{s}</span>;
  return (
    <div>
      {showFindings && pr.findings.map((f) => renderBadge(f.severity))}
      {showCost && !compact && <Cost value={pr.cost} />}
    </div>
  );
}
```

✅
```tsx
function SeverityBadge({ severity }: { severity: Severity }) { … }

function PrCard({ pr, variant = 'default', children }: {
  pr: Pr; variant?: 'default' | 'compact'; children?: React.ReactNode;
}) {
  return <Card variant={variant}><PrCardHeader pr={pr} />{children}</Card>;
}

// caller decides what to show
<PrCard pr={pr}>
  <FindingsList findings={pr.findings} highlight="critical" />
  <RunCostBadge usage={pr.usage} />
</PrCard>
```

## 6. Feature importing a sibling feature

❌
```ts
// features/runs/components/RunRow.tsx
import { ReviewPanel } from '@/features/reviews/components/ReviewPanel';
```

✅ Compose in the page; or, if both need the same piece, promote it to shared.
```tsx
// app/runs/[id]/page.tsx
<RunDetails id={id} aside={<ReviewPanel runId={id} />} />
```

## 7. `'use client'` too high → on the leaf

❌
```tsx
// app/repos/layout.tsx
'use client';                     // whole subtree becomes client code
export default function Layout({ children }) { … <SearchBox /> … }
```

✅
```tsx
// app/repos/layout.tsx  (Server Component)
export default function Layout({ children }) {
  return <Shell header={<SearchBox />}>{children}</Shell>;
}
// _components/SearchBox/SearchBox.tsx
'use client';
export function SearchBox() { const [q, setQ] = useState(''); … }
```

> **Examples 8–9 apply only to data model (b), a Next app with a server-only DAL.** In an app that calls an external backend through client data hooks (like DevDigest `client/`), a new page uses a data hook plus a mutation hook instead (see SKILL.md, "In this repo").

## 8. Server Component calling its own Route Handler → call the data layer

❌
```tsx
export default async function Page() {
  const res = await fetch('http://localhost:3000/api/comments'); // extra hop, breaks at build
  return <Comments items={await res.json()} />;
}
```

✅
```tsx
import { getComments } from '@/features/comments/server/data'; // 'server-only' DAL
export default async function Page({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = await params;
  return <Comments items={await getComments(repoId)} />;
}
```

## 9. Fat Server Action → thin action over the DAL

❌
```ts
'use server';
export async function resolveComment(id: string) {
  await db.update(comments).set({ resolved: true }).where(eq(comments.id, id)); // no validation, no auth
}
```

✅
```ts
// features/comments/server/actions.ts
'use server';
const Input = z.object({ id: z.string().uuid() });

export async function resolveCommentAction(raw: unknown) {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid-input' } as const; // expected error = value
  await resolveComment(parsed.data.id);   // DAL: verifySession() + ownership check + DTO
  revalidatePath('/repos/[repoId]/comments', 'page');
  return { ok: true } as const;
}
```

## 10. `export *` barrel → direct imports

❌
```ts
// features/reviews/index.ts
export * from './components';
export * from './api';
export * from './domain';
```

✅
```ts
import { ReviewPanel } from '@/features/reviews/components/ReviewPanel';
// a thin per-component index is fine:  PrList/index.ts → export { PrList } from './PrList';
```
