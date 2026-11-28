/* CommunitySkillsDrawer — "Search community skills…". Browse the curated
   catalog; Import fetches the entry and hands it to the SAME review/confirm
   step as a file import (saved disabled, trust notice shown). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Chip, Drawer, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import type { CommunitySkillDetail } from "@devdigest/shared";
import { useCommunitySkills, useFetchCommunitySkill } from "../../../../lib/hooks/skills";
import { ImportReview } from "../ImportReview";
import { s } from "./styles";

const TAGS = ["security", "performance"] as const;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function CommunitySkillsDrawer({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (id: string) => void;
}) {
  const t = useTranslations("skills");
  const [q, setQ] = React.useState("");
  const [lang, setLang] = React.useState("");
  const [tag, setTag] = React.useState("");
  const dq = useDebounced(q, 250);
  const { data, isLoading, isError, refetch } = useCommunitySkills(dq, lang, tag);
  const fetchDetail = useFetchCommunitySkill();
  const [picked, setPicked] = React.useState<CommunitySkillDetail | null>(null);

  const pick = (slug: string) => fetchDetail.mutate(slug, { onSuccess: (d) => setPicked(d) });

  return (
    <Drawer width={720} title={t("community.title")} subtitle={t("community.subtitle")} onClose={onClose}>
      {picked ? (
        <ImportReview
          initial={{
            draft: { name: picked.name, description: picked.desc, type: picked.type, body: picked.body },
            warnings: [],
          }}
          source="community"
          origin={picked.repo}
          backLabel={t("import.back")}
          onBack={() => setPicked(null)}
          onCancel={onClose}
          onImported={onImported}
        />
      ) : (
        <div style={s.wrap}>
          <div style={s.search}>
            <Icon.Search size={13} style={s.searchIcon} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("community.searchPlaceholder")}
              aria-label={t("community.searchPlaceholder")}
              style={s.searchInput}
            />
          </div>
          <div style={s.chips}>
            <Chip active={lang === ""} onClick={() => setLang("")}>
              {t("community.allLanguages")}
            </Chip>
            <Chip active={lang === "TypeScript"} onClick={() => setLang(lang === "TypeScript" ? "" : "TypeScript")}>
              {t("community.typescript")}
            </Chip>
            {TAGS.map((tg) => (
              <Chip key={tg} icon="Tag" active={tag === tg} onClick={() => setTag(tag === tg ? "" : tg)}>
                {tg}
              </Chip>
            ))}
          </div>

          {isLoading && <Skeleton height={96} />}
          {isError && <ErrorState body={t("community.loadError")} onRetry={() => refetch()} />}
          {data && data.length === 0 && (
            <EmptyState icon="Search" title={t("community.noMatch.title")} body={t("community.noMatch.body")} />
          )}
          {fetchDetail.isError && (
            <div role="alert" style={s.error}>
              {t("import.failed")}: {fetchDetail.error instanceof Error ? fetchDetail.error.message : ""}
            </div>
          )}
          {(data ?? []).map((c) => (
            <div key={c.slug} style={s.card}>
              <div style={s.cardHead}>
                <span className="mono" style={s.cardName}>
                  {c.name}
                </span>
                <span style={s.stars}>
                  <Icon.Star size={12} /> {c.stars.toLocaleString("en-US")}
                </span>
              </div>
              <div style={s.desc}>{c.desc}</div>
              <div style={s.cardFoot}>
                <span className="mono" style={s.repo}>
                  {c.repo}
                </span>
                <Badge>{c.lang}</Badge>
                <div style={{ flex: 1 }} />
                <Button
                  kind="secondary"
                  size="sm"
                  icon="Plus"
                  onClick={() => pick(c.slug)}
                  disabled={fetchDetail.isPending}
                >
                  {t("community.import")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
