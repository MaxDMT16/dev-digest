import { describe, it, expect } from "vitest";
import { countBySeverity } from "./findings";

describe("countBySeverity", () => {
  it("returns zeros for an empty list", () => {
    expect(countBySeverity([])).toEqual({ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 });
  });

  it("counts each level and ignores unknown severities", () => {
    const list = [
      { severity: "CRITICAL" },
      { severity: "WARNING" },
      { severity: "WARNING" },
      { severity: "INFO" },
      { severity: "toString" },
    ];
    expect(countBySeverity(list)).toEqual({ CRITICAL: 1, WARNING: 2, SUGGESTION: 0 });
  });
});
