/* SkillFormFields — the four editable fields shared by Config, Create and
   Import review: name, description (directive hint), type, markdown body. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, FormField, Icon, SelectInput, TextInput, Textarea } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { SKILL_NAME_RE, SKILL_TYPES } from "../../constants";
import { estimateTokens } from "../../helpers";
import { s } from "./styles";

export interface SkillFormValues {
  name: string;
  description: string;
  type: SkillType;
  body: string;
}

export function SkillFormFields({
  values,
  onChange,
  unsaved,
  namePlaceholder,
  bodyPlaceholder,
  bodyRows = 14,
}: {
  values: SkillFormValues;
  onChange: (patch: Partial<SkillFormValues>) => void;
  unsaved?: boolean;
  namePlaceholder?: string;
  bodyPlaceholder?: string;
  bodyRows?: number;
}) {
  const t = useTranslations("skills");
  const nameBad = values.name !== "" && !SKILL_NAME_RE.test(values.name);
  const typeOptions = SKILL_TYPES.map((v) => ({ value: v, label: t(`type.${v}`) }));
  return (
    <>
      <FormField label={t("config.name")} required hint={nameBad ? undefined : t("config.nameHint")}>
        <TextInput
          value={values.name}
          onChange={(v) => onChange({ name: v })}
          placeholder={namePlaceholder}
          mono
          aria-label={t("config.name")}
        />
        {nameBad && <div style={s.error}>{t("config.nameInvalid")}</div>}
      </FormField>
      <FormField label={t("config.description")} hint={t("config.descriptionHint")}>
        <TextInput
          value={values.description}
          onChange={(v) => onChange({ description: v })}
          placeholder={t("config.descriptionPlaceholder")}
          aria-label={t("config.description")}
        />
      </FormField>
      <FormField label={t("config.type")}>
        <SelectInput value={values.type} onChange={(v) => onChange({ type: v as SkillType })} options={typeOptions} />
      </FormField>
      <FormField label={t("config.body")} required hint={t("config.bodyHint")}>
        <div style={s.editor}>
          <div style={s.editorHead}>
            <Icon.FileText size={13} style={s.fileIcon} />
            <span className="mono" style={s.fileName}>
              {(values.name || "skill") + ".md"}
            </span>
            {unsaved && <Badge color="var(--warn, #f59e0b)">{t("config.unsaved")}</Badge>}
            <span className="mono" style={s.tokens}>
              {t("config.tokens", { count: estimateTokens(values.body) })}
            </span>
          </div>
          <Textarea
            value={values.body}
            onChange={(v) => onChange({ body: v })}
            rows={bodyRows}
            mono
            placeholder={bodyPlaceholder}
          />
        </div>
      </FormField>
    </>
  );
}
