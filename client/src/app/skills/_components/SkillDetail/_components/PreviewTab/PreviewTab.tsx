/* Preview tab — the skill body rendered as Markdown. Uses the vendored
   Markdown primitive (inert images, safe links; no raw HTML). Imported and
   community skills get a trust banner: it is someone else's text. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Markdown } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { s } from "./styles";

const EXTERNAL = new Set<string>(["imported_url", "imported_file", "community"]);

export function PreviewTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  return (
    <div style={s.wrap}>
      <h2 style={s.h2}>{t("preview.title")}</h2>
      <p style={s.caption}>{t("preview.caption")}</p>
      {EXTERNAL.has(skill.source) && (
        <div role="note" style={s.trust}>
          <Icon.AlertTriangle size={16} style={s.trustIcon} />
          <div>
            <div style={s.trustTitle}>{t("preview.trustTitle")}</div>
            <div>{t("preview.trust")}</div>
          </div>
        </div>
      )}
      <div style={s.box}>
        {skill.body.trim() ? <Markdown>{skill.body}</Markdown> : <span style={s.caption}>{t("preview.empty")}</span>}
      </div>
    </div>
  );
}
