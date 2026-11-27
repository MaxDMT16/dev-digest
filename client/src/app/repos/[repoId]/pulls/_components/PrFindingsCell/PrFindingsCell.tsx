/* PrFindingsCell — severity marks for a PR row + hover popover with a findings preview. */
"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Icon, SEV, SeverityBadge } from "@devdigest/ui";
import type { PrFindingsSummary, Severity } from "@devdigest/shared";
import { lineLabel } from "../../[number]/_components/FindingCard/helpers";
import { s as rowStyles } from "../../styles";
import { s } from "./styles";

const SEVERITY_ORDER: Severity[] = ["CRITICAL", "WARNING", "SUGGESTION"];
const POPOVER_WIDTH = 340;
const POPOVER_EST_HEIGHT = 260;
const CLOSE_DELAY_MS = 120;

export function PrFindingsCell({ summary }: { summary?: PrFindingsSummary | null }) {
  const t = useTranslations("prReview");
  const ref = React.useRef<HTMLDivElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const id = React.useId();

  const cancelClose = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const open = () => {
    cancelClose();
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = r.bottom + 6;
    const top = below + POPOVER_EST_HEIGHT > window.innerHeight ? Math.max(8, r.top - 6 - POPOVER_EST_HEIGHT) : below;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - POPOVER_WIDTH - 8));
    setPos({ top, left });
  };
  const scheduleClose = () => {
    cancelClose();
    timer.current = setTimeout(() => setPos(null), CLOSE_DELAY_MS);
  };
  React.useEffect(() => cancelClose, []);

  if (!summary || summary.total === 0) {
    return (
      <div>
        <span style={rowStyles.muted}>—</span>
      </div>
    );
  }

  const hidden = summary.total - summary.preview.length;
  return (
    <div>
      <div
        ref={ref}
        tabIndex={0}
        style={s.cell}
        aria-describedby={pos ? id : undefined}
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        onFocus={open}
        onBlur={scheduleClose}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") setPos(null);
        }}
      >
        {SEVERITY_ORDER.filter((l) => summary.counts[l] > 0).map((l) => {
          const I = Icon[SEV[l].icon];
          const label = t("list.findings.severityCount", {
            count: summary.counts[l],
            level: SEV[l].label.toLowerCase(),
          });
          return (
            <span key={l} style={s.mark(SEV[l].c)} aria-label={label} title={label}>
              <I size={12} />
              <span className="tnum">{summary.counts[l]}</span>
            </span>
          );
        })}
      </div>
      {pos &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={s.popover(pos.top, pos.left)}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={s.title}>{t("list.findings.popoverTitle", { count: summary.total })}</div>
            <ul style={s.list}>
              {summary.preview.map((f) => (
                <li key={f.id} style={s.item}>
                  <div style={s.itemHead}>
                    <SeverityBadge severity={f.severity} compact />
                    <span style={s.itemTitle}>{f.title}</span>
                  </div>
                  <span className="mono" style={s.itemFile}>
                    {f.file}:{lineLabel(f)}
                  </span>
                </li>
              ))}
            </ul>
            {hidden > 0 && <div style={s.more}>{t("list.findings.more", { count: hidden })}</div>}
          </div>,
          document.body,
        )}
    </div>
  );
}
