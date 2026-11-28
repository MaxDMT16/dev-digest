import type { CSSProperties } from "react";

/** Co-located styles for SkillFormFields. */
export const s = {
  error: { fontSize: 12, color: "var(--crit)", marginTop: 6 } satisfies CSSProperties,
  editor: { display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  editorHead: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  fileIcon: { color: "var(--text-muted)" } satisfies CSSProperties,
  fileName: { fontSize: 13, fontWeight: 600 } satisfies CSSProperties,
  tokens: { marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
