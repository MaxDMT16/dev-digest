/* CreateSkillModal — "Create new" from the Add Skill menu. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Modal } from "@devdigest/ui";
import { useCreateSkill } from "../../../../lib/hooks/skills";
import { useToast } from "../../../../lib/toast";
import { SKILL_NAME_RE } from "../../constants";
import { SkillFormFields, type SkillFormValues } from "../SkillFormFields";

export function CreateSkillModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const t = useTranslations("skills");
  const toast = useToast();
  const create = useCreateSkill();
  const [values, setValues] = React.useState<SkillFormValues>({
    name: "",
    description: "",
    type: "custom",
    body: "",
  });
  const valid = SKILL_NAME_RE.test(values.name) && values.body.trim() !== "";

  const submit = () =>
    create.mutate(values, {
      onSuccess: (sk) => {
        toast.success(t("create.created"));
        onCreated(sk.id);
      },
    });

  return (
    <Modal
      width={680}
      title={t("create.title")}
      subtitle={t("create.subtitle")}
      onClose={onClose}
      footer={
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button kind="secondary" onClick={onClose}>
            {t("create.cancel")}
          </Button>
          <Button kind="primary" icon="Check" onClick={submit} disabled={!valid || create.isPending}>
            {create.isPending ? t("create.creating") : t("create.create")}
          </Button>
        </div>
      }
    >
      <SkillFormFields
        values={values}
        onChange={(p) => setValues((v) => ({ ...v, ...p }))}
        namePlaceholder={t("create.namePlaceholder")}
        bodyPlaceholder={t("create.bodyPlaceholder")}
        bodyRows={10}
      />
    </Modal>
  );
}
