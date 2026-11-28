/* SkillCard — name, type badge, source, description, enabled toggle and 30d
   usage footer. The toggle saves immediately (same as AgentCard). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge, Toggle } from "@devdigest/ui";
import type { SkillListItem } from "@devdigest/shared";
import { useDeleteSkill } from "../../../../lib/hooks/skills";
import { TYPE_COLORS } from "../../constants";
import { pct } from "../../helpers";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  onClick,
  onToggle,
  onDeleted,
}: {
  skill: SkillListItem;
  active?: boolean;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
  onDeleted?: () => void;
}) {
  const t = useTranslations("skills");
  const del = useDeleteSkill();
  const tc = TYPE_COLORS[skill.type];
  const pull = pct(skill.usage.pull_rate);
  const accept = pct(skill.usage.accept_rate);
  return (
    <div onClick={onClick} style={s.card(!!active, skill.enabled)}>
      <div style={s.headerRow}>
        <div style={s.iconBox(tc.color, tc.bg)}>
          <Icon.Sparkles size={15} />
        </div>
        <span className="mono" style={s.name}>
          {skill.name}
        </span>
        {onToggle && (
          <div onClick={(e) => e.stopPropagation()}>
            <Toggle on={skill.enabled} onChange={onToggle} size={14} />
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            const msg = t("card.deleteConfirm", { name: skill.name, count: skill.usage.agent_count });
            if (window.confirm(msg)) del.mutate(skill.id, { onSuccess: () => onDeleted?.() });
          }}
          disabled={del.isPending}
          title={t("card.delete")}
          aria-label={t("card.delete")}
          style={s.trash(del.isPending)}
        >
          <Icon.Trash size={14} />
        </button>
      </div>
      <div style={s.description}>{skill.description}</div>
      <div style={s.metaRow}>
        <Badge color={tc.color} bg={tc.bg}>
          {t(`type.${skill.type}`)}
        </Badge>
        <span style={s.source}>{t(`source.${skill.source}`)}</span>
      </div>
      <div style={s.footer}>
        <span>{t("card.agents", { count: skill.usage.agent_count })}</span>
        {pull != null && <span>{t("card.pull", { pct: pull })}</span>}
        {accept != null && <span style={s.accept}>{t("card.accept", { pct: accept })}</span>}
      </div>
    </div>
  );
}
