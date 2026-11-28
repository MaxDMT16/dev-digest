import type { SkillType } from "@devdigest/shared";

/** Tabs of the skill detail pane (Evals is deferred; see client/specs/2026-11-28-skills-ui.md). */
export const SKILL_TABS = ["config", "preview", "stats", "versions"] as const;
export type SkillTab = (typeof SKILL_TABS)[number];

export const SKILL_TYPES: readonly SkillType[] = ["rubric", "convention", "security", "custom"];

/** Matches the server's `SkillName` contract. */
export const SKILL_NAME_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;

/** Import limit (server enforces the same). */
export const IMPORT_MAX_BYTES = 1_000_000;

/** Badge colours per skill type (tokens come from the design system). */
export const TYPE_COLORS: Record<SkillType, { color: string; bg: string }> = {
  rubric: { color: "var(--accent)", bg: "var(--accent-bg)" },
  convention: { color: "var(--ok)", bg: "var(--ok-bg, rgba(34,197,94,0.12))" },
  security: { color: "var(--crit)", bg: "var(--crit-bg, rgba(239,68,68,0.12))" },
  custom: { color: "var(--text-secondary)", bg: "var(--bg-hover)" },
};

/** Donut colours per finding category (falls back to the accent). */
export const CATEGORY_COLORS: Record<string, string> = {
  security: "var(--crit)",
  bug: "var(--warn, #f59e0b)",
  perf: "#8b5cf6",
  style: "var(--accent)",
};
