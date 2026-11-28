import type { CSSProperties } from "react";

/** Co-located styles for ImportReview. */
export const s = {
  wrap: { display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  trust: {
    display: "flex",
    gap: 12,
    padding: 14,
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.5,
    border: "1px solid var(--warn, #f59e0b)",
    background: "var(--warn-bg, rgba(245,158,11,0.1))",
  } satisfies CSSProperties,
  trustIcon: { color: "var(--warn, #f59e0b)", flexShrink: 0, marginTop: 2 } satisfies CSSProperties,
  trustTitle: { fontWeight: 700, marginBottom: 2 } satisfies CSSProperties,
  files: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  label: { fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.03em" } satisfies CSSProperties,
  used: { fontSize: 13 } satisfies CSSProperties,
  hint: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  skipped: {
    padding: 12,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    fontSize: 13,
  } satisfies CSSProperties,
  warnings: {
    padding: 12,
    borderRadius: 8,
    border: "1px solid var(--border-strong)",
    background: "var(--bg-elevated)",
    fontSize: 13,
  } satisfies CSSProperties,
  list: { margin: "8px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)" } satisfies CSSProperties,
  actions: { display: "flex", alignItems: "center", gap: 10, marginTop: 4 } satisfies CSSProperties,
} as const;
