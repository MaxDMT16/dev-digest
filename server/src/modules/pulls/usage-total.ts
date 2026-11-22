import { and, eq, inArray, sql } from 'drizzle-orm';
import type { PrUsageTotal } from '@devdigest/shared';
import * as t from '../../db/schema.js';
import type { Db } from '../../db/client.js';

type Num = number | string | null;

export interface PrUsageAggregateRow {
  costUsd: Num;
  tokensIn: Num;
  tokensOut: Num;
  runs: number | string;
  runsWithoutCost: number | string;
}

/** Map one aggregate row (bigint/numeric may arrive as strings) to the contract. */
export function toPrUsageTotal(row: PrUsageAggregateRow): PrUsageTotal {
  const runs = Number(row.runs);
  const runsWithoutCost = Number(row.runsWithoutCost);
  return {
    // Unknown stays null, never 0: only when no done run has a cost.
    cost_usd: runsWithoutCost === runs || row.costUsd == null ? null : Number(row.costUsd),
    tokens_in: Number(row.tokensIn ?? 0),
    tokens_out: Number(row.tokensOut ?? 0),
    runs,
    runs_without_cost: runsWithoutCost,
  };
}

/** One aggregate query over all finished runs of the given PRs. */
export async function loadPrUsageTotals(
  db: Db,
  prIds: string[],
): Promise<Map<string, PrUsageTotal>> {
  const out = new Map<string, PrUsageTotal>();
  if (prIds.length === 0) return out;
  const rows = await db
    .select({
      prId: t.agentRuns.prId,
      costUsd: sql<Num>`sum(${t.agentRuns.costUsd})`,
      tokensIn: sql<Num>`sum(${t.agentRuns.tokensIn})`,
      tokensOut: sql<Num>`sum(${t.agentRuns.tokensOut})`,
      runs: sql<number | string>`count(*)`,
      runsWithoutCost: sql<number | string>`count(*) filter (where ${t.agentRuns.costUsd} is null)`,
    })
    .from(t.agentRuns)
    .where(and(inArray(t.agentRuns.prId, prIds), eq(t.agentRuns.status, 'done')))
    .groupBy(t.agentRuns.prId);
  for (const r of rows) {
    if (r.prId) out.set(r.prId, toPrUsageTotal(r));
  }
  return out;
}
