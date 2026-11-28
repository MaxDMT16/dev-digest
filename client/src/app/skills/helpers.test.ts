import { describe, it, expect } from "vitest";
import type { SkillListItem } from "@devdigest/shared";
import { estimateTokens, filterSkills, lineDiff, parseTab, pct, toBase64 } from "./helpers";

const sk = (name: string, description = ""): SkillListItem => ({
  id: name,
  name,
  description,
  type: "custom",
  source: "manual",
  body: "b",
  enabled: true,
  version: 1,
  usage: { agent_count: 0, pull_rate: null, accept_rate: null },
});

describe("skills helpers", () => {
  it("filterSkills matches name and description, case-insensitively", () => {
    const list = [sk("secret-gate", "Detects keys"), sk("no-then", "async/await only")];
    expect(filterSkills(list, "")).toHaveLength(2);
    expect(filterSkills(list, "SECRET").map((s) => s.name)).toEqual(["secret-gate"]);
    expect(filterSkills(list, "await").map((s) => s.name)).toEqual(["no-then"]);
    expect(filterSkills(list, "zzz")).toEqual([]);
  });

  it("pct rounds a rate and keeps null as null", () => {
    expect(pct(0.742)).toBe("74");
    expect(pct(0)).toBe("0");
    expect(pct(null)).toBeNull();
  });

  it("parseTab falls back to config for unknown values", () => {
    expect(parseTab("versions")).toBe("versions");
    expect(parseTab("evals")).toBe("config");
    expect(parseTab(null)).toBe("config");
  });

  it("estimateTokens is ~chars/4", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });

  it("toBase64 round-trips bytes", () => {
    const bytes = new TextEncoder().encode("hello skill");
    expect(atob(toBase64(bytes.buffer as ArrayBuffer))).toBe("hello skill");
  });

  it("lineDiff marks added, removed and unchanged lines", () => {
    const d = lineDiff("a\nb\nc", "a\nB\nc\nd");
    expect(d).toEqual([
      { kind: "same", text: "a" },
      { kind: "del", text: "b" },
      { kind: "add", text: "B" },
      { kind: "same", text: "c" },
      { kind: "add", text: "d" },
    ]);
  });

  it("lineDiff against nothing is all additions; identical text has no changes", () => {
    expect(lineDiff("", "x\ny").map((l) => l.kind)).toEqual(["add", "add"]);
    expect(lineDiff("same", "same").every((l) => l.kind === "same")).toBe(true);
  });
});
