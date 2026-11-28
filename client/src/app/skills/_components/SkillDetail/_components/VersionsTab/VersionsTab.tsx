/* Versions tab — immutable history of a skill's body + description. Diff shows
   a version against the one before it; Restore appends a NEW version. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Modal, Skeleton } from "@devdigest/ui";
import type { Skill, SkillVersion } from "@devdigest/shared";
import { useRestoreSkillVersion, useSkillVersions } from "../../../../../../lib/hooks/skills";
import { useToast } from "../../../../../../lib/toast";
import { lineDiff } from "../../../../helpers";
import { s } from "./styles";

export function VersionsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useSkillVersions(skill.id);
  const restore = useRestoreSkillVersion();
  const [diffOf, setDiffOf] = React.useState<SkillVersion | null>(null);

  if (isLoading) return <Skeleton height={140} />;
  if (isError || !data) return <ErrorState body={t("versions.loadError")} onRetry={() => refetch()} />;

  const previousOf = (v: SkillVersion) => data.find((x) => x.version < v.version);
  const doRestore = (v: SkillVersion) => {
    if (!window.confirm(t("versions.restoreConfirm", { version: v.version }))) return;
    restore.mutate(
      { id: skill.id, version: v.version },
      { onSuccess: () => toast.success(t("versions.restoredToast", { version: v.version })) },
    );
  };

  const prev = diffOf ? previousOf(diffOf) : undefined;
  const lines = diffOf ? lineDiff(prev?.body ?? "", diffOf.body) : [];

  return (
    <div style={s.wrap}>
      <div style={s.head}>
        <h2 style={s.h2}>{t("versions.title")}</h2>
        <Badge>{t("versions.count", { count: data.length })}</Badge>
      </div>
      <p style={s.hint}>{t("versions.hint")}</p>
      <div style={s.list}>
        {data.map((v) => {
          const current = v.version === skill.version;
          return (
            <div key={v.version} style={s.row}>
              <span className="mono" style={s.ver}>
                v{v.version}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.msg}>{v.message ?? (v.version === 1 ? t("versions.initial") : "")}</div>
                <div style={s.date}>{v.created_at.slice(0, 10)}</div>
              </div>
              {current ? (
                <Badge color="var(--ok)" dot>
                  {t("versions.current")}
                </Badge>
              ) : (
                <div style={s.actions}>
                  <Button kind="ghost" size="sm" icon="Eye" onClick={() => setDiffOf(v)}>
                    {t("versions.diff")}
                  </Button>
                  <Button kind="secondary" size="sm" icon="History" onClick={() => doRestore(v)} disabled={restore.isPending}>
                    {t("versions.restore")}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {diffOf && (
        <Modal
          width={760}
          title={t("versions.diffTitle", { from: prev?.version ?? 0, to: diffOf.version })}
          subtitle={t("versions.diffAgainst")}
          onClose={() => setDiffOf(null)}
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button kind="secondary" onClick={() => setDiffOf(null)}>
                {t("versions.close")}
              </Button>
            </div>
          }
        >
          {lines.every((l) => l.kind === "same") ? (
            <div style={s.hint}>{t("versions.noChange")}</div>
          ) : (
            <pre className="mono" style={s.diff}>
              {lines.map((l, i) => (
                <div key={i} data-kind={l.kind} style={s.line(l.kind)}>
                  {l.kind === "add" ? "+ " : l.kind === "del" ? "- " : "  "}
                  {l.text}
                </div>
              ))}
            </pre>
          )}
        </Modal>
      )}
    </div>
  );
}
