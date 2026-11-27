import type { Severity } from "@devdigest/shared";

export type SeverityCounts = Record<Severity, number>;

/** Count findings per severity level (all three levels always present, zeros included). */
export function countBySeverity(findings: { severity: string }[]): SeverityCounts {
  const counts: SeverityCounts = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  for (const f of findings) {
    if (Object.hasOwn(counts, f.severity)) counts[f.severity as Severity] += 1;
  }
  return counts;
}
