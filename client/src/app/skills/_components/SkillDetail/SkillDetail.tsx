/* SkillDetail — right pane: header (name, type, version) + tabs. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, ErrorState, Icon, Skeleton, Tabs } from "@devdigest/ui";
import { useSkill } from "../../../../lib/hooks/skills";
import { ApiError } from "../../../../lib/api";
import { SKILL_TABS, TYPE_COLORS, type SkillTab } from "../../constants";
import { ConfigTab } from "./_components/ConfigTab";
import { PreviewTab } from "./_components/PreviewTab";
import { StatsTab } from "./_components/StatsTab";
import { VersionsTab } from "./_components/VersionsTab";
import { s } from "./styles";

const TAB_ICONS = { config: "Settings", preview: "Eye", stats: "BarChart", versions: "History" } as const;

export function SkillDetail({ id, tab, onTab }: { id: string; tab: SkillTab; onTab: (t: SkillTab) => void }) {
  const t = useTranslations("skills");
  const { data: skill, isLoading, isError, error, refetch } = useSkill(id);

  if (isError || (!isLoading && !skill)) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div style={{ flex: 1 }}>
        <ErrorState
          title={notFound ? t("detail.notFound.title") : undefined}
          body={notFound ? t("detail.notFound.body") : t("detail.loadError")}
          onRetry={notFound ? undefined : () => refetch()}
        />
      </div>
    );
  }
  if (isLoading || !skill) {
    return (
      <div style={s.loading}>
        <Skeleton height={24} width={240} />
        <Skeleton height={200} />
      </div>
    );
  }

  const tc = TYPE_COLORS[skill.type];
  const tabs = SKILL_TABS.map((k) => ({ key: k, label: t(`detail.tabs.${k}`), icon: TAB_ICONS[k] }));
  return (
    <div style={s.pane}>
      <div style={s.header}>
        <Icon.Sparkles size={18} style={{ color: tc.color }} />
        <h1 className="mono" style={s.h1}>
          {skill.name}
        </h1>
        <Badge color={tc.color} bg={tc.bg}>
          {t(`type.${skill.type}`)}
        </Badge>
        <Badge mono icon="GitCommit">
          v{skill.version}
        </Badge>
        {!skill.enabled && <Badge color="var(--text-muted)">{t("detail.disabled")}</Badge>}
      </div>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={(k) => onTab(k as SkillTab)} pad="0 24px" />
      </div>
      <div style={s.body}>
        {tab === "config" && <ConfigTab skill={skill} />}
        {tab === "preview" && <PreviewTab skill={skill} />}
        {tab === "stats" && <StatsTab skill={skill} />}
        {tab === "versions" && <VersionsTab skill={skill} />}
      </div>
    </div>
  );
}
