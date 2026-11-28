/* Skills tab — attach skills to this agent, enable/disable them for it, and
   reorder them. Order is the order of the blocks in the prompt. Every change
   autosaves the FULL ordered set (optimistic, rolled back on error). */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge, Checkbox, EmptyState, ErrorState, IconBtn, Icon, Skeleton } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useAgentSkills, useSetAgentSkills, useSkills } from "../../../../../../../lib/hooks/skills";
import { TYPE_COLORS } from "../../../../../../skills/constants";
import {
  buildRows,
  enabledCount,
  filterRows,
  moveSkill,
  moveSkillTo,
  toggleSkill,
  type SkillItem,
} from "./helpers";
import { s } from "./styles";

export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const skillsQ = useSkills();
  const linksQ = useAgentSkills(agent.id);
  const save = useSetAgentSkills(agent.id);
  const [filter, setFilter] = React.useState("");
  const dragId = React.useRef<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);

  if (skillsQ.isLoading || linksQ.isLoading) return <Skeleton height={160} />;
  if (skillsQ.isError || linksQ.isError || !skillsQ.data) {
    return (
      <ErrorState
        body={t("skills.loadError")}
        onRetry={() => {
          void skillsQ.refetch();
          void linksQ.refetch();
        }}
      />
    );
  }
  if (skillsQ.data.length === 0) {
    return (
      <div style={s.wrap}>
        <EmptyState icon="Sparkles" title={t("skills.empty")} />
        <div style={{ textAlign: "center" }}>
          <Link href="/skills" style={s.link}>
            {t("skills.emptyCta")}
          </Link>
        </div>
      </div>
    );
  }

  const rows = buildRows(skillsQ.data, linksQ.data);
  const shown = filterRows(rows, filter);
  const commit = (items: SkillItem[]) => save.mutate(items);

  return (
    <div style={s.wrap}>
      <div style={s.head}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <Badge color="var(--accent)" bg="var(--accent-bg)">
          {t("skills.enabledCount", { linked: enabledCount(rows), total: rows.length })}
        </Badge>
        <div style={s.search}>
          <Icon.Search size={13} style={s.searchIcon} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("skills.filterPlaceholder")}
            aria-label={t("skills.filterPlaceholder")}
            style={s.searchInput}
          />
        </div>
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>

      <div style={s.list} role="list">
        {shown.map((r) => {
          const tc = TYPE_COLORS[r.skill.type];
          const globallyOff = !r.skill.enabled;
          const linkedIdx = rows.filter((x) => x.linked).findIndex((x) => x.skill.id === r.skill.id);
          const linkedCount = rows.filter((x) => x.linked).length;
          return (
            <div
              key={r.skill.id}
              role="listitem"
              draggable={r.linked}
              onDragStart={(e) => {
                dragId.current = r.skill.id;
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", r.skill.id);
              }}
              onDragOver={(e) => {
                if (dragId.current && r.linked) {
                  e.preventDefault();
                  setOverId(r.skill.id);
                }
              }}
              onDragLeave={() => setOverId(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId.current && r.linked) commit(moveSkillTo(rows, dragId.current, r.skill.id));
                dragId.current = null;
                setOverId(null);
              }}
              onDragEnd={() => {
                dragId.current = null;
                setOverId(null);
              }}
              style={s.row(r.linked && r.enabled, overId === r.skill.id)}
            >
              <span style={s.grip(r.linked)} title={t("skills.dragHandle")} aria-hidden>
                <Icon.Menu size={14} />
              </span>
              <Checkbox checked={r.linked && r.enabled} onChange={() => commit(toggleSkill(rows, r.skill.id))} />
              <div style={s.nameCol}>
                <span className="mono" style={s.name}>
                  {r.skill.name}
                </span>
                {globallyOff && <span style={s.off}>{t("skills.disabledGlobally")}</span>}
              </div>
              <Badge color={tc.color} bg={tc.bg}>
                {r.skill.type}
              </Badge>
              {r.linked && (
                <span style={s.moves}>
                  <IconBtn
                    icon="ArrowUp"
                    label={`${t("skills.moveUp")}: ${r.skill.name}`}
                    size={24}
                    onClick={() => linkedIdx > 0 && commit(moveSkill(rows, r.skill.id, -1))}
                  />
                  <IconBtn
                    icon="ArrowDown"
                    label={`${t("skills.moveDown")}: ${r.skill.name}`}
                    size={24}
                    onClick={() => linkedIdx < linkedCount - 1 && commit(moveSkill(rows, r.skill.id, 1))}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
