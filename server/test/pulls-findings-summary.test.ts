import { describe, it, expect } from 'vitest';
import {
  toPrFindingsSummary,
  FINDINGS_PREVIEW_LIMIT,
  type SummaryFindingRow,
} from '../src/modules/pulls/findings-summary.js';

const row = (o: Partial<SummaryFindingRow>): SummaryFindingRow => ({
  id: 'f',
  severity: 'WARNING',
  title: 't',
  file: 'a.ts',
  startLine: 1,
  endLine: 1,
  confidence: 0.5,
  ...o,
});

describe('toPrFindingsSummary', () => {
  it('returns zeros for no findings', () => {
    expect(toPrFindingsSummary([])).toEqual({
      total: 0,
      counts: { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 },
      preview: [],
    });
  });

  it('counts per severity and ignores unknown severities', () => {
    const r = toPrFindingsSummary([
      row({ id: '1', severity: 'CRITICAL' }),
      row({ id: '2' }),
      row({ id: '3' }),
      row({ id: '4', severity: 'toString' }),
    ]);
    expect(r.counts).toEqual({ CRITICAL: 1, WARNING: 2, SUGGESTION: 0 });
    expect(r.total).toBe(3);
  });

  it('orders preview by severity then confidence and caps it', () => {
    const rows = [
      row({ id: 's', severity: 'SUGGESTION', confidence: 0.99 }),
      row({ id: 'w-low', confidence: 0.2 }),
      row({ id: 'w-high', confidence: 0.9 }),
      row({ id: 'c', severity: 'CRITICAL', confidence: 0.1 }),
      ...Array.from({ length: 5 }, (_, i) => row({ id: `x${i}`, severity: 'SUGGESTION', confidence: 0.1 })),
    ];
    const r = toPrFindingsSummary(rows);
    expect(r.preview.map((p) => p.id).slice(0, 3)).toEqual(['c', 'w-high', 'w-low']);
    expect(r.preview).toHaveLength(FINDINGS_PREVIEW_LIMIT);
    expect(r.total).toBe(9);
  });
});
