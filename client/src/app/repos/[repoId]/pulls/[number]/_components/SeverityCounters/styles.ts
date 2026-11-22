import type { CSSProperties } from "react";
import { SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";

/** Co-located styles for SeverityCounters. */
export const s = {
  group: { display: "flex", alignItems: "center", gap: 6 } satisfies CSSProperties,
  separator: { color: "var(--text-tertiary)", fontSize: 13 } satisfies CSSProperties,
  pill: (level: Severity, active: boolean, muted: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.04em",
    cursor: "pointer",
    color: SEV[level].c,
    background: active ? SEV[level].bg : "transparent",
    border: `1px solid ${active ? SEV[level].c : "var(--border)"}`,
    opacity: muted ? 0.45 : 1,
  }),
} as const;
