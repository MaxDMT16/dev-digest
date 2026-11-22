/** True when the run has a displayable cost: finished (if status known) and cost known. */
export function hasUsageData(costUsd: number | null | undefined, status?: string | null): boolean {
  if (status != null && status !== "done") return false;
  return costUsd != null && !Number.isNaN(costUsd);
}

/** Tokens are shown only when both sides are positive. */
export function hasTokens(tokensIn?: number | null, tokensOut?: number | null): boolean {
  return (tokensIn ?? 0) > 0 && (tokensOut ?? 0) > 0;
}
