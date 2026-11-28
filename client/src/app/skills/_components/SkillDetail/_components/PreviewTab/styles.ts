import type { CSSProperties } from "react";

/** Co-located styles for the skill PreviewTab. */
export const s = {
  wrap: { maxWidth: 820 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  caption: { fontSize: 13, color: "var(--text-muted)", margin: "4px 0 16px" } satisfies CSSProperties,
  trust: {
    display: "flex",
    gap: 12,
    padding: 14,
    marginBottom: 16,
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.5,
    border: "1px solid var(--warn, #f59e0b)",
    background: "var(--warn-bg, rgba(245,158,11,0.1))",
  } satisfies CSSProperties,
  trustIcon: { color: "var(--warn, #f59e0b)", flexShrink: 0, marginTop: 2 } satisfies CSSProperties,
  trustTitle: { fontWeight: 700, marginBottom: 2 } satisfies CSSProperties,
  box: {
    padding: 24,
    borderRadius: 9,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
} as const;
