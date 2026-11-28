/* ImportReview — the preview/confirm step shared by file import and community
   import. NOTHING is saved until the Import button is pressed, and the server
   stores the result disabled. Imported skills are someone else's instructions
   inside the agent's prompt, so the trust notice and warnings are always shown. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon } from "@devdigest/ui";
import type { SkillDraft, SkillImportPreview, SkillImportWarning } from "@devdigest/shared";
import { useImportSkill } from "../../../../lib/hooks/skills";
import { useToast } from "../../../../lib/toast";
import { SKILL_NAME_RE } from "../../constants";
import { SkillFormFields, type SkillFormValues } from "../SkillFormFields";
import { s } from "./styles";

export interface ImportReviewInitial {
  draft: SkillDraft;
  files?: SkillImportPreview["files"];
  warnings: SkillImportWarning[];
}

export function ImportReview({
  initial,
  source,
  origin,
  backLabel,
  onBack,
  onCancel,
  onImported,
}: {
  initial: ImportReviewInitial;
  source: "imported_file" | "community";
  origin?: string;
  backLabel: string;
  onBack: () => void;
  onCancel: () => void;
  onImported: (id: string) => void;
}) {
  const t = useTranslations("skills");
  const toast = useToast();
  const save = useImportSkill();
  const [values, setValues] = React.useState<SkillFormValues>(initial.draft);
  const valid = SKILL_NAME_RE.test(values.name) && values.body.trim() !== "";

  const confirm = () =>
    save.mutate(
      { draft: values, source, ...(origin ? { origin } : {}) },
      {
        onSuccess: (sk) => {
          toast.success(t("import.success", { name: sk.name }));
          onImported(sk.id);
        },
      },
    );

  const ignored = initial.files?.ignored ?? [];

  return (
    <div style={s.wrap}>
      <div role="note" style={s.trust}>
        <Icon.AlertTriangle size={16} style={s.trustIcon} />
        <div>
          <div style={s.trustTitle}>{t("import.trustTitle")}</div>
          <div>{t("import.trust")}</div>
        </div>
      </div>

      {initial.files && (
        <div style={s.files}>
          <span style={s.label}>{t("import.usedFile")}</span>
          <span className="mono" style={s.used}>
            {initial.files.used}
          </span>
        </div>
      )}
      {ignored.length > 0 && (
        <div style={s.skipped}>
          <div style={s.label}>{t("import.skippedTitle")}</div>
          <div style={s.hint}>{t("import.skippedBody")}</div>
          <ul style={s.list}>
            {ignored.map((f) => (
              <li key={f.path}>
                <span className="mono">{f.path}</span>{" "}
                <span style={s.hint}>
                  — {t.has(`import.reason.${f.reason}`) ? t(`import.reason.${f.reason}`) : f.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {initial.warnings.length > 0 && (
        <div style={s.warnings}>
          <div style={s.label}>{t("import.warningsTitle")}</div>
          <ul style={s.list}>
            {initial.warnings.map((w) => (
              <li key={w.code}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      <SkillFormFields values={values} onChange={(p) => setValues((v) => ({ ...v, ...p }))} bodyRows={12} />

      {save.isError && (
        <div role="alert" style={s.error}>
          {t("import.failed")}: {save.error instanceof Error ? save.error.message : ""}
        </div>
      )}

      <div style={s.actions}>
        <Button kind="ghost" onClick={onBack}>
          {backLabel}
        </Button>
        <div style={{ flex: 1 }} />
        <Button kind="secondary" onClick={onCancel}>
          {t("import.cancel")}
        </Button>
        <Button kind="primary" icon="Upload" onClick={confirm} disabled={!valid || save.isPending}>
          {save.isPending ? t("import.importing") : t("import.import")}
        </Button>
      </div>
    </div>
  );
}
