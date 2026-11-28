/* Config tab — name / description / type / markdown body + Enabled toggle.
   Controlled state, reset when the skill changes (same pattern as the agent
   ConfigTab). Saving a changed body or description creates a new version. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, TextInput, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useUpdateSkill } from "../../../../../../lib/hooks/skills";
import { useToast } from "../../../../../../lib/toast";
import { SKILL_NAME_RE } from "../../../../constants";
import { SkillFormFields, type SkillFormValues } from "../../../SkillFormFields";
import { s } from "./styles";

function toValues(sk: Skill): SkillFormValues {
  return { name: sk.name, description: sk.description, type: sk.type, body: sk.body };
}

export function ConfigTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const update = useUpdateSkill();
  const [values, setValues] = React.useState<SkillFormValues>(toValues(skill));
  const [enabled, setEnabled] = React.useState(skill.enabled);
  const [note, setNote] = React.useState("");

  // Reset the form when switching skills.
  React.useEffect(() => {
    setValues(toValues(skill));
    setEnabled(skill.enabled);
    setNote("");
  }, [skill.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The card toggle saves immediately; keep this switch in step with it.
  React.useEffect(() => setEnabled(skill.enabled), [skill.enabled]);

  const contentChanged = values.body !== skill.body || values.description !== skill.description;
  const dirty =
    contentChanged || values.name !== skill.name || values.type !== skill.type || enabled !== skill.enabled;
  const valid = SKILL_NAME_RE.test(values.name) && values.body.trim() !== "";

  const save = () =>
    update.mutate(
      {
        id: skill.id,
        patch: {
          ...(values.name !== skill.name ? { name: values.name } : {}),
          ...(values.description !== skill.description ? { description: values.description } : {}),
          ...(values.type !== skill.type ? { type: values.type } : {}),
          ...(values.body !== skill.body ? { body: values.body } : {}),
          ...(enabled !== skill.enabled ? { enabled } : {}),
          ...(contentChanged && note.trim() ? { version_message: note.trim() } : {}),
        },
      },
      {
        onSuccess: (data) => {
          setNote("");
          toast.success(t("config.savedToast", { version: data.version }));
        },
      },
    );

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("config.title")}</h2>
        <label style={s.enabledLabel}>
          {t("config.enabled")}
          <Toggle on={enabled} onChange={setEnabled} size={16} />
        </label>
      </div>
      <SkillFormFields
        values={values}
        onChange={(p) => setValues((v) => ({ ...v, ...p }))}
        unsaved={dirty}
      />
      {contentChanged && (
        <FormField label={t("config.changeNote")}>
          <TextInput value={note} onChange={setNote} placeholder={t("config.changeNotePlaceholder")} />
        </FormField>
      )}
      <div style={s.actions}>
        <Button kind="primary" icon="Check" onClick={save} disabled={!dirty || !valid || update.isPending}>
          {update.isPending ? t("config.saving") : t("config.save")}
        </Button>
        {update.isSuccess && !dirty && (
          <span style={s.savedNote}>{t("config.saved", { version: update.data?.version })}</span>
        )}
      </div>
    </div>
  );
}
