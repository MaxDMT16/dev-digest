"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Modal,
  Button,
  Markdown,
  SEV,
  SeverityBadge,
  CategoryTag,
  MonoLink,
  ConfidenceNum,
  type Category,
} from "@devdigest/ui";
import type { FindingRecord, Severity } from "@devdigest/shared";
import { visibleFindings } from "../FindingsPanel/helpers";
import { lineLabel } from "../FindingCard/helpers";
import { githubBlobUrl } from "@/lib/github-urls";

/** Read-only list of one run's findings of one severity, opened from a timeline mark. */
export function RunFindingsModal({
  agentName,
  level,
  findings,
  repoFullName,
  headSha,
  onGoToReview,
  onClose,
}: {
  agentName: string;
  level: Severity;
  findings: FindingRecord[];
  repoFullName?: string | null;
  headSha?: string | null;
  onGoToReview?: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("prReview");
  const shown = React.useMemo(() => visibleFindings(findings, false, level), [findings, level]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Modal
      width={760}
      title={t("timeline.findingsModal.title", {
        agent: agentName,
        count: shown.length,
        level: SEV[level].label,
      })}
      onClose={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {onGoToReview && (
            <Button kind="secondary" size="sm" onClick={onGoToReview}>
              {t("timeline.findingsModal.goToReview")}
            </Button>
          )}
          <Button kind="ghost" size="sm" onClick={onClose}>
            {t("timeline.findingsModal.close")}
          </Button>
        </div>
      }
    >
      {shown.length === 0 ? (
        <div style={{ padding: 24, fontSize: 13, color: "var(--text-muted)" }}>
          {t("timeline.findingsModal.empty")}
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {shown.map((f) => {
            const href =
              repoFullName && headSha
                ? githubBlobUrl(repoFullName, headSha, f.file, f.start_line, f.end_line)
                : undefined;
            return (
              <li
                key={f.id}
                style={{
                  padding: "14px 24px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <SeverityBadge severity={f.severity as Parameters<typeof SeverityBadge>[0]["severity"]} compact />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{f.title}</span>
                  <CategoryTag category={f.category as Category} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <MonoLink href={href}>
                    {f.file}:{lineLabel(f)}
                  </MonoLink>
                  <ConfidenceNum value={f.confidence} />
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  <Markdown>{f.rationale}</Markdown>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
