/* SkillsWorkspace — /skills and /skills/:id share this layout: skills column on
   the left, detail pane (or an empty prompt) on the right. Tab state lives in
   ?tab= like the agent editor. */
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@devdigest/ui";
import { AppShell } from "../../../../components/app-shell";
import { parseTab } from "../../helpers";
import type { SkillTab } from "../../constants";
import { SkillsListColumn } from "../SkillsListColumn";
import { SkillDetail } from "../SkillDetail";
import { s } from "./styles";

export function SkillsWorkspace({ selectedId }: { selectedId?: string }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const search = useSearchParams();
  const tab = parseTab(search.get("tab"));

  const setTab = (next: SkillTab) => {
    const sp = new URLSearchParams(search.toString());
    sp.set("tab", next);
    router.replace(`/skills/${selectedId}?${sp.toString()}`);
  };

  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.crumbSkills"), href: selectedId ? "/skills" : undefined },
    ...(selectedId ? [{ label: t("detail.crumbSkill") }] : []),
  ];

  return (
    <AppShell crumb={crumb}>
      <div style={s.row}>
        <SkillsListColumn selectedId={selectedId} />
        {selectedId ? (
          <SkillDetail id={selectedId} tab={tab} onTab={setTab} />
        ) : (
          <div style={s.empty}>
            <EmptyState icon="Sparkles" title={t("page.selectPrompt.title")} body={t("page.selectPrompt.body")} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
