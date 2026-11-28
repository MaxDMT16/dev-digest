import type { CSSProperties } from "react";

/** Co-located styles for CommunitySkillsDrawer. */
export const s = {
  wrap: { display: "flex", flexDirection: "column", gap: 14 } satisfies CSSProperties,
  search: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 7,
    border: "1px solid var(--border-strong)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  searchIcon: { color: "var(--text-muted)" } satisfies CSSProperties,
  searchInput: {
    flex: 1,
    fontSize: 14,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  chips: { display: "flex", flexWrap: "wrap", gap: 8 } satisfies CSSProperties,
  card: {
    padding: 16,
    borderRadius: 9,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  } satisfies CSSProperties,
  cardHead: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  cardName: { fontSize: 14, fontWeight: 600, flex: 1 } satisfies CSSProperties,
  stars: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    color: "var(--warn, #f59e0b)",
  } satisfies CSSProperties,
  desc: { fontSize: 13, color: "var(--text-secondary)" } satisfies CSSProperties,
  cardFoot: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  repo: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)" } satisfies CSSProperties,
} as const;
