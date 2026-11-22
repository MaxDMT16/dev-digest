import { describe, it, expect } from 'vitest';
import { formatCostPlain } from '../src/modules/reviews/format-cost.js';

describe('formatCostPlain', () => {
  it.each([
    [1e-7, '0.0000001'],
    [0.0137421, '0.0137421'],
    [0.001, '0.001'],
    [0, '0'],
    [2, '2'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatCostPlain(input)).toBe(expected);
  });
});
