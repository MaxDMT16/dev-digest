/* SeverityCounters — `N CRITICAL · N WARNING · N SUGGESTIONS` pills that double
   as a single-select severity filter. Pure/controlled: counts + active come from props. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import type { SeverityCounts } from "../../../../../../../lib/findings";
import { FILTER_SEVERITIES } from "../FindingsPanel/constants";
import { s } from "./styles";

export function SeverityCounters({
  counts,
  active,
  onSelect,
}: {
  counts: SeverityCounts;
  active: Severity | null;
  onSelect: (next: Severity | null) => void;
}) {
  const t = useTranslations("prReview");

  return (
    <div style={s.group}>
      {FILTER_SEVERITIES.map((level, i) => {
        const I = Icon[SEV[level].icon];
        const isActive = active === level;
        return (
          <React.Fragment key={level}>
            {i > 0 && (
              <span style={s.separator} aria-hidden="true">
                {t("panel.severitySeparator")}
              </span>
            )}
            <button
              type="button"
              aria-pressed={isActive}
              title={
                isActive
                  ? t("panel.clearSeverityFilter")
                  : t("panel.filterBySeverity", { level: SEV[level].label.toLowerCase() })
              }
              onClick={() => onSelect(isActive ? null : level)}
              style={s.pill(level, isActive, active !== null && !isActive)}
            >
              <I size={12.5} />
              <span className="tnum">{t(`panel.severityCount.${level}`, { count: counts[level] })}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
