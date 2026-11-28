/* ImportSkillDrawer — "Import from file…". Step 1 picks a .md/.zip/.skill file
   and asks the server to PARSE it (persists nothing); step 2 is the shared
   ImportReview where the user reads everything and confirms. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Drawer, Icon } from "@devdigest/ui";
import type { SkillImportPreview } from "@devdigest/shared";
import { useImportPreview } from "../../../../lib/hooks/skills";
import { IMPORT_MAX_BYTES } from "../../constants";
import { toBase64 } from "../../helpers";
import { ImportReview } from "../ImportReview";
import { s } from "./styles";

export function ImportSkillDrawer({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (id: string) => void;
}) {
  const t = useTranslations("skills");
  const preview = useImportPreview();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = React.useState<SkillImportPreview | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setLocalError(null);
    if (file.size > IMPORT_MAX_BYTES) {
      setLocalError(t("import.tooLarge"));
      return;
    }
    const content_base64 = toBase64(await file.arrayBuffer());
    preview.mutate({ filename: file.name, content_base64 }, { onSuccess: (p) => setParsed(p) });
  };

  const error = localError ?? (preview.isError && preview.error instanceof Error ? preview.error.message : null);

  return (
    <Drawer width={720} title={t("import.title")} subtitle={t("import.subtitle")} onClose={onClose}>
      {parsed ? (
        <ImportReview
          initial={parsed}
          source="imported_file"
          backLabel={t("import.back")}
          onBack={() => {
            setParsed(null);
            preview.reset();
          }}
          onCancel={onClose}
          onImported={onImported}
        />
      ) : (
        <div style={s.pick}>
          <input
            ref={inputRef}
            type="file"
            accept=".md,.markdown,.zip,.skill"
            aria-label={t("import.chooseFile")}
            style={{ display: "none" }}
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Icon.Upload size={28} style={s.icon} />
          <Button
            kind="primary"
            icon="Upload"
            onClick={() => inputRef.current?.click()}
            disabled={preview.isPending}
          >
            {preview.isPending ? t("import.parsing") : t("import.chooseFile")}
          </Button>
          <div style={s.hint}>{t("import.accept")}</div>
          {error && (
            <div role="alert" style={s.error}>
              {t("import.failed")}: {error}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
