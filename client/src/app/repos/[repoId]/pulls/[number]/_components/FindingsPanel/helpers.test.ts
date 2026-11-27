import { describe, it, expect } from "vitest";
import type { FindingRecord } from "@devdigest/shared";
import { countBySeverity } from "../../../../../../../lib/findings";
import { visibleFindings } from "./helpers";

const mk = (id: string, severity: FindingRecord["severity"], confidence: number) =>
  ({ id, severity, confidence }) as FindingRecord;

const LIST = [
  mk("s1", "SUGGESTION", 0.9),
  mk("c1", "CRITICAL", 0.9),
  mk("w1", "WARNING", 0.3),
  mk("c2", "CRITICAL", 0.4),
];

describe("visibleFindings", () => {
  it("sorts by severity with no filters", () => {
    expect(visibleFindings(LIST, false).map((f) => f.id)).toEqual(["c1", "c2", "w1", "s1"]);
  });

  it("filters by severity", () => {
    expect(visibleFindings(LIST, false, "CRITICAL").map((f) => f.id)).toEqual(["c1", "c2"]);
  });

  it("combines severity with hideLow", () => {
    expect(visibleFindings(LIST, true, "CRITICAL").map((f) => f.id)).toEqual(["c1"]);
    expect(visibleFindings(LIST, true, "WARNING")).toEqual([]);
  });

  it("counts after the confidence filter, zeros included", () => {
    expect(countBySeverity(visibleFindings(LIST, true))).toEqual({
      CRITICAL: 1,
      WARNING: 0,
      SUGGESTION: 1,
    });
  });
});
