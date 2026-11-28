/* SkillsListColumn — left column: heading, "Add Skill" menu (create / import /
   community), search and the skill cards. Owns the create/import overlays. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Dropdown, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import { useSkills, useUpdateSkill } from "../../../../lib/hooks/skills";
import { filterSkills } from "../../helpers";
import { SkillCard } from "../SkillCard";
import { CreateSkillModal } from "../CreateSkillModal";
import { ImportSkillDrawer } from "../ImportSkillDrawer";
import { CommunitySkillsDrawer } from "../CommunitySkillsDrawer";
import { s } from "./styles";

type Overlay = "create" | "import" | "community" | null;

export function SkillsListColumn({ selectedId }: { selectedId?: string }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const update = useUpdateSkill();
  const [search, setSearch] = React.useState("");
  const [overlay, setOverlay] = React.useState<Overlay>(null);

  const list = filterSkills(skills ?? [], search);
  const open = (id: string) => router.push(`/skills/${id}`);
  const close = () => setOverlay(null);
  const openCreated = (id: string) => {
    close();
    open(id);
  };

  return (
    <div style={s.col}>
      {overlay === "create" && <CreateSkillModal onClose={close} onCreated={openCreated} />}
      {overlay === "import" && <ImportSkillDrawer onClose={close} onImported={openCreated} />}
      {overlay === "community" && <CommunitySkillsDrawer onClose={close} onImported={openCreated} />}

      <div style={s.head}>
        <div style={s.titleRow}>
          <h1 style={s.h1}>{t("page.heading")}</h1>
          <Dropdown
            width={240}
            align="right"
            trigger={
              <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                {t("page.addSkill")}
              </Button>
            }
            items={[
              { label: t("page.menu.create"), icon: "Edit", onClick: () => setOverlay("create") },
              { label: t("page.menu.import"), icon: "Upload", onClick: () => setOverlay("import") },
              { divider: true },
              { label: t("page.menu.community"), icon: "Globe", onClick: () => setOverlay("community") },
            ]}
          />
        </div>
        <div style={s.search}>
          <Icon.Search size={13} style={s.searchIcon} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("page.searchPlaceholder")}
            aria-label={t("page.searchPlaceholder")}
            style={s.searchInput}
          />
        </div>
      </div>

      <div style={s.list}>
        {isLoading && (
          <>
            <Skeleton height={110} />
            <Skeleton height={110} />
          </>
        )}
        {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
        {!isLoading && !isError && (skills ?? []).length === 0 && (
          <div style={s.muted}>{t("page.empty.title")}</div>
        )}
        {!isLoading && !isError && (skills ?? []).length > 0 && list.length === 0 && (
          <div style={s.muted}>{t("page.noMatch")}</div>
        )}
        {list.map((sk) => (
          <SkillCard
            key={sk.id}
            skill={sk}
            active={sk.id === selectedId}
            onClick={() => open(sk.id)}
            onToggle={(enabled) => update.mutate({ id: sk.id, patch: { enabled } })}
            onDeleted={() => {
              if (sk.id === selectedId) router.push("/skills");
            }}
          />
        ))}
      </div>
    </div>
  );
}
