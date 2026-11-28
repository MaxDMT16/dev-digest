import type { CSSProperties } from "react";

/** Co-located styles for SkillsWorkspace. */
export const s = {
  row: { display: "flex", height: "calc(100vh - 52px)" } satisfies CSSProperties,
  empty: { flex: 1, display: "grid", placeItems: "center" } satisfies CSSProperties,
} as const;
