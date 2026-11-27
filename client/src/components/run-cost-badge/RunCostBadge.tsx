"use client";

import { useTranslations } from "next-intl";
import {
  formatTokenCount,
  formatTokenTotal,
  formatUsd,
  formatUsdPrecise,
} from "@/lib/format-usage";
import { hasTokens, hasUsageData } from "./helpers";

export interface RunCostBadgeProps {
  variant: "compact" | "detailed";
  costUsd: number | null | undefined;
  tokensIn?: number | null;
  tokensOut?: number | null;
  /** Run status; when provided and not "done" there is no data. */
  status?: string | null;
  /** Some runs lacked cost: prefix "≥". */
  partial?: boolean;
  /** Tooltip override. */
  title?: string;
}

/** Cost (and optionally token) badge for a run or a PR total. Unknown cost renders "—". */
export function RunCostBadge({
  variant,
  costUsd,
  tokensIn,
  tokensOut,
  status,
  partial,
  title,
}: RunCostBadgeProps) {
  const t = useTranslations("runs");
  const hasData = hasUsageData(costUsd, status);
  const showTokens = hasData && hasTokens(tokensIn, tokensOut);
  const prefix = hasData && partial ? "≥" : "";

  const cost = `${prefix}${formatUsd(hasData ? costUsd : null)}`;
  const label =
    title ??
    (hasData
      ? [
          `${prefix}${formatUsdPrecise(costUsd)}`,
          showTokens
            ? t("cost.tokens", {
                tokensIn: formatTokenTotal(tokensIn),
                tokensOut: formatTokenTotal(tokensOut),
              })
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : t("cost.noData"));

  return (
    <span
      className="mono tnum"
      style={{ color: "var(--text-muted)", fontSize: variant === "detailed" ? 12 : undefined }}
      title={label}
      aria-label={label}
    >
      {variant === "detailed" && <span aria-hidden="true">$ </span>}
      {cost}
      {variant === "detailed" && showTokens && (
        <> {formatTokenCount(tokensIn)}→{formatTokenCount(tokensOut)}</>
      )}
    </span>
  );
}

export default RunCostBadge;
