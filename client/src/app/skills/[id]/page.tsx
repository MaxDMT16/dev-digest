/* /skills/:id — skills list + detail (Config / Preview / Stats / Versions).
   Tab state lives in ?tab=. */
"use client";

import React from "react";
import { useParams } from "next/navigation";
import { SkillsWorkspace } from "../_components/SkillsWorkspace";

export default function SkillPage() {
  const { id } = useParams<{ id: string }>();
  return <SkillsWorkspace selectedId={id} />;
}
