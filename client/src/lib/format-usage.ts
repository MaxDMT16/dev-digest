/** Formatters for run cost / token usage. Unknown cost is never rendered as "$0.00". */

const DASH = "—";

const isMissing = (v: number | null | undefined): v is null | undefined =>
  v == null || Number.isNaN(v);

/** Compact USD: 2 decimals >=1, 3 decimals >=0.01, 2 significant digits above 0.0001. */
export function formatUsd(v: number | null | undefined): string {
  if (isMissing(v) || v < 0) return DASH;
  if (v === 0) return "$0";
  if (v < 0.0001) return "<$0.0001";
  if (v < 0.01) {
    // Round first: 0.009996 -> 0.010 must take the >=0.01 branch, not print "$0.0100".
    const r = Number(v.toPrecision(2));
    if (r < 0.01) return `$${r.toFixed(4)}`;
    return `$${r.toFixed(3)}`;
  }
  if (v < 1) {
    const r = Number(v.toFixed(3));
    return r < 1 ? `$${r.toFixed(3)}` : "$1.00";
  }
  return `$${v.toFixed(2)}`;
}

/** Full-precision USD for tooltips (JS default number formatting). */
export function formatUsdPrecise(v: number | null | undefined): string {
  if (isMissing(v)) return DASH;
  return `$${v}`;
}

/** Compact token count: "950", "8.2K", "12.0K" (always one decimal for K and M), "1.2M". */
export function formatTokenCount(n: number | null | undefined): string {
  if (isMissing(n)) return DASH;
  if (n < 1000) return String(Math.round(n));
  if (n < 1e6) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1e6).toFixed(1)}M`;
}

/** Grouped total: 9119 -> "9,119". */
export function formatTokenTotal(n: number | null | undefined): string {
  if (isMissing(n)) return DASH;
  return new Intl.NumberFormat("en-US").format(n);
}
