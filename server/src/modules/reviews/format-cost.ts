/** Plain-decimal USD (no exponent, trailing zeros trimmed): 1e-7 -> "0.0000001". */
export function formatCostPlain(v: number): string {
  const s = v.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
  return s === '' || s === '-0' ? '0' : s;
}
