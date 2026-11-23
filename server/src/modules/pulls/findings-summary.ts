import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { PrFindingsSummary, Severity } from '@devdigest/shared';
import * as t from '../../db/schema.js';
import type { Db } from '../../db/client.js';

/** Max findings shown in the PR list popover; the rest is "+N more". */
export const FINDINGS_PREVIEW_LIMIT = 5;

const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 0, WARNING: 1, SUGGESTION: 2 };

export interface SummaryFindingRow {
  id: string;
  severity: string;
  title: string;
  file: string;
  startLine: number;
  endLine: number;
  confidence: number;
}

/** Pure: group the open findings of one PR into counts + a capped, ordered preview. */
export function toPrFindingsSummary(rows: SummaryFindingRow[]): PrFindingsSummary {
  const counts: PrFindingsSummary['counts'] = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  const known = rows.filter((r) => Object.hasOwn(counts, r.severity));
  for (const r of known) counts[r.severity as Severity] += 1;

  const preview = [...known]
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity as Severity] - SEVERITY_RANK[b.severity as Severity] ||
        b.confidence - a.confidence,
    )
    .slice(0, FINDINGS_PREVIEW_LIMIT)
    .map((r) => ({
      id: r.id,
      severity: r.severity as Severity,
      title: r.title,
      file: r.file,
      start_line: r.startLine,
      end_line: r.endLine,
    }));

  return { total: known.length, counts, preview };
}

/**
 * Open findings of each agent's LATEST review, per PR. Two queries for all PRs:
 * the latest `review` row per (pr, agent), then their non-dismissed findings.
 * A PR with a review but no open findings gets a zero summary; a PR with no
 * review is absent from the map (the route turns that into `null`).
 */
export async function loadPrFindingsSummaries(
  db: Db,
  prIds: string[],
): Promise<Map<string, PrFindingsSummary>> {
  const out = new Map<string, PrFindingsSummary>();
  if (prIds.length === 0) return out;

  // Newest first; the first review seen per (pr, agent) is that agent's latest run.
  // `agent_id = null` (seeded/legacy reviews) counts as a single anonymous agent.
  const reviewRows = await db
    .select({ id: t.reviews.id, prId: t.reviews.prId, agentId: t.reviews.agentId })
    .from(t.reviews)
    .where(and(inArray(t.reviews.prId, prIds), eq(t.reviews.kind, 'review')))
    .orderBy(desc(t.reviews.createdAt));

  const seen = new Set<string>();
  const reviewPr = new Map<string, string>();
  for (const rv of reviewRows) {
    const key = `${rv.prId}:${rv.agentId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    reviewPr.set(rv.id, rv.prId);
  }
  if (reviewPr.size === 0) return out;

  const findingRows = await db
    .select({
      id: t.findings.id,
      reviewId: t.findings.reviewId,
      severity: t.findings.severity,
      title: t.findings.title,
      file: t.findings.file,
      startLine: t.findings.startLine,
      endLine: t.findings.endLine,
      confidence: t.findings.confidence,
    })
    .from(t.findings)
    .where(and(inArray(t.findings.reviewId, [...reviewPr.keys()]), isNull(t.findings.dismissedAt)));

  const byPr = new Map<string, SummaryFindingRow[]>();
  for (const prId of new Set(reviewPr.values())) byPr.set(prId, []);
  for (const f of findingRows) {
    const prId = reviewPr.get(f.reviewId);
    if (prId) byPr.get(prId)!.push(f);
  }
  for (const [prId, rows] of byPr) out.set(prId, toPrFindingsSummary(rows));
  return out;
}
