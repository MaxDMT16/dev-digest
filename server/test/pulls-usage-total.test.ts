import { describe, it, expect } from 'vitest';
import { toPrUsageTotal } from '../src/modules/pulls/usage-total.js';

describe('toPrUsageTotal', () => {
  it('sums costs when every done run is costed', () => {
    expect(
      toPrUsageTotal({ costUsd: 0.03, tokensIn: 100, tokensOut: 20, runs: 2, runsWithoutCost: 0 }),
    ).toEqual({ cost_usd: 0.03, tokens_in: 100, tokens_out: 20, runs: 2, runs_without_cost: 0 });
  });

  it('keeps the sum of known costs and the uncosted count when partial', () => {
    const r = toPrUsageTotal({
      costUsd: 0.014,
      tokensIn: 10,
      tokensOut: 5,
      runs: 3,
      runsWithoutCost: 2,
    });
    expect(r.cost_usd).toBe(0.014);
    expect(r.runs).toBe(3);
    expect(r.runs_without_cost).toBe(2);
  });

  it('returns null cost (never 0) when no done run has a cost', () => {
    const r = toPrUsageTotal({ costUsd: null, tokensIn: 7, tokensOut: 3, runs: 2, runsWithoutCost: 2 });
    expect(r.cost_usd).toBeNull();
    expect(r.tokens_in).toBe(7);
  });

  it('coerces bigint/numeric strings to numbers', () => {
    expect(
      toPrUsageTotal({
        costUsd: '0.0123',
        tokensIn: '8213',
        tokensOut: '1302',
        runs: '2',
        runsWithoutCost: '0',
      }),
    ).toEqual({ cost_usd: 0.0123, tokens_in: 8213, tokens_out: 1302, runs: 2, runs_without_cost: 0 });
  });

  it('treats null token sums as 0', () => {
    const r = toPrUsageTotal({ costUsd: 0.5, tokensIn: null, tokensOut: null, runs: 1, runsWithoutCost: 0 });
    expect(r.tokens_in).toBe(0);
    expect(r.tokens_out).toBe(0);
  });
});
