/* Stats tab — 30-day usage of this skill. Numbers are CORRELATIONAL: they
   count runs in which the skill was present, not an effect of the skill. */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ErrorState, Icon, MetricCard, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useSkillStats } from "../../../../../../lib/hooks/skills";
import { CATEGORY_COLORS } from "../../../../constants";
import { pct } from "../../../../helpers";
import { s } from "./styles";

const RING = 130;
const STROKE = 22;

/** Ring chart with COUNT labels (the vendored Donut formats values as money). */
function CategoryRing({ segments }: { segments: { category: string; count: number }[] }) {
  const total = segments.reduce((n, x) => n + x.count, 0);
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={s.ringRow}>
      <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} role="img" aria-label="findings by category">
        <g transform={`rotate(-90 ${RING / 2} ${RING / 2})`}>
          {segments.map((seg) => {
            const len = (seg.count / total) * c;
            const el = (
              <circle
                key={seg.category}
                cx={RING / 2}
                cy={RING / 2}
                r={r}
                fill="none"
                stroke={CATEGORY_COLORS[seg.category] ?? "var(--accent)"}
                strokeWidth={STROKE}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-acc}
              />
            );
            acc += len;
            return el;
          })}
        </g>
      </svg>
      <div style={s.legend}>
        {segments.map((seg) => (
          <div key={seg.category} style={s.legendRow}>
            <span style={s.swatch(CATEGORY_COLORS[seg.category] ?? "var(--accent)")} />
            <span style={s.legendLabel}>{seg.category}</span>
            <span className="mono tnum" style={s.legendValue}>
              {seg.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const { data, isLoading, isError, refetch } = useSkillStats(skill.id);

  if (isLoading) return <Skeleton height={140} />;
  if (isError || !data) return <ErrorState body={t("stats.loadError")} onRetry={() => refetch()} />;

  const pull = pct(data.pull_rate);
  const accept = pct(data.accept_rate);
  return (
    <div style={s.wrap}>
      <div style={s.metrics}>
        <MetricCard label={t("stats.usedBy").toUpperCase()} value={data.agent_count} suffix={` ${t("stats.agentsCount", { count: data.agent_count })}`} />
        <MetricCard label={t("stats.pullFrequency").toUpperCase()} value={pull ?? t("stats.noData")} suffix={pull ? "%" : undefined} />
        <MetricCard label={t("stats.acceptRate").toUpperCase()} value={accept ?? t("stats.noData")} suffix={accept ? "%" : undefined} />
        <MetricCard label={t("stats.findings30d").toUpperCase()} value={data.findings_30d} />
      </div>
      <p style={s.note}>
        <Icon.Info size={13} /> {t("stats.correlation")}
      </p>

      <div style={s.panels}>
        <div style={s.panel}>
          <div style={s.panelTitle}>
            <Icon.Cpu size={13} /> {t("stats.agentsUsing")}
          </div>
          {data.agents.length === 0 && <div style={s.muted}>{t("stats.noAgents")}</div>}
          {data.agents.map((a) => (
            <Link key={a.id} href={`/agents/${a.id}?tab=skills`} style={s.agentRow}>
              <Icon.Cpu size={14} style={s.agentIcon} />
              <span style={{ flex: 1 }}>{a.name}</span>
              <span style={s.muted}>{t("stats.open")}</span>
            </Link>
          ))}
        </div>
        <div style={s.panel}>
          <div style={s.panelTitle}>
            <Icon.Tag size={13} /> {t("stats.byCategory")}
          </div>
          {data.by_category.length === 0 ? (
            <div style={s.muted}>{t("stats.noFindings")}</div>
          ) : (
            <CategoryRing segments={data.by_category} />
          )}
        </div>
      </div>
    </div>
  );
}
