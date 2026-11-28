import type { CSSProperties } from "react";

/** Co-located styles for the skill VersionsTab. */
export const s = {
  wrap: { maxWidth: 900 } satisfies CSSProperties,
  head: { display: "flex", alignItems: "center", gap: 12 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  hint: { fontSize: 13, color: "var(--text-muted)", margin: "6px 0 18px" } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "14px 16px",
    borderRadius: 9,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  ver: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--accent)",
    background: "var(--accent-bg)",
    padding: "6px 10px",
    borderRadius: 6,
  } satisfies CSSProperties,
  msg: { fontSize: 14, fontWeight: 600 } satisfies CSSProperties,
  date: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 } satisfies CSSProperties,
  actions: { display: "flex", gap: 8 } satisfies CSSProperties,
  diff: { margin: 0, fontSize: 12.5, lineHeight: 1.6, overflow: "auto", maxHeight: "60vh" } satisfies CSSProperties,
  line: (kind: "same" | "add" | "del"): CSSProperties => ({
    whiteSpace: "pre-wrap",
    padding: "0 8px",
    background:
      kind === "add" ? "var(--ok-bg, rgba(34,197,94,0.12))" : kind === "del" ? "var(--crit-bg, rgba(239,68,68,0.12))" : "transparent",
    color: kind === "same" ? "var(--text-secondary)" : "var(--text-primary)",
  }),
} as const;
