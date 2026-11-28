import { describe, it, expect } from "vitest";
import type { AgentSkillLink, SkillListItem } from "@devdigest/shared";
import { buildRows, enabledCount, filterRows, moveSkill, moveSkillTo, toggleSkill, toItems } from "./helpers";

const sk = (id: string, enabled = true): SkillListItem => ({
  id,
  name: id,
  description: "",
  type: "custom",
  source: "manual",
  body: "b",
  enabled,
  version: 1,
  usage: { agent_count: 0, pull_rate: null, accept_rate: null },
});
const link = (skill_id: string, order: number, enabled = true): AgentSkillLink => ({
  agent_id: "a",
  skill_id,
  order,
  enabled,
});

const SKILLS = [sk("alpha"), sk("beta"), sk("gamma"), sk("delta")];
const LINKS = [link("gamma", 0), link("alpha", 1, false)];

describe("agent skills tab helpers", () => {
  it("puts linked skills first in link order, then the rest by name", () => {
    const rows = buildRows(SKILLS, LINKS);
    expect(rows.map((r) => [r.skill.id, r.linked, r.enabled])).toEqual([
      ["gamma", true, true],
      ["alpha", true, false],
      ["beta", false, false],
      ["delta", false, false],
    ]);
  });

  it("ignores links to skills that no longer exist", () => {
    const rows = buildRows(SKILLS, [link("ghost", 0), link("beta", 1)]);
    expect(toItems(rows)).toEqual([{ skill_id: "beta", enabled: true }]);
  });

  it("counts only skills enabled for the agent", () => {
    expect(enabledCount(buildRows(SKILLS, LINKS))).toBe(1);
  });

  it("checking an unlinked skill appends it enabled", () => {
    expect(toggleSkill(buildRows(SKILLS, LINKS), "beta")).toEqual([
      { skill_id: "gamma", enabled: true },
      { skill_id: "alpha", enabled: false },
      { skill_id: "beta", enabled: true },
    ]);
  });

  it("unchecking a linked skill keeps its position and just disables it", () => {
    expect(toggleSkill(buildRows(SKILLS, LINKS), "gamma")).toEqual([
      { skill_id: "gamma", enabled: false },
      { skill_id: "alpha", enabled: false },
    ]);
    expect(toggleSkill(buildRows(SKILLS, LINKS), "alpha")).toEqual([
      { skill_id: "gamma", enabled: true },
      { skill_id: "alpha", enabled: true },
    ]);
  });

  it("moves a skill up/down among linked skills and stops at the edges", () => {
    const rows = buildRows(SKILLS, LINKS);
    expect(moveSkill(rows, "alpha", -1).map((i) => i.skill_id)).toEqual(["alpha", "gamma"]);
    expect(moveSkill(rows, "gamma", 1).map((i) => i.skill_id)).toEqual(["alpha", "gamma"]);
    expect(moveSkill(rows, "gamma", -1).map((i) => i.skill_id)).toEqual(["gamma", "alpha"]);
    expect(moveSkill(rows, "beta", -1).map((i) => i.skill_id)).toEqual(["gamma", "alpha"]);
  });

  it("drag and drop puts the dragged skill where the target is, keeping enabled flags", () => {
    const rows = buildRows(SKILLS, [link("alpha", 0), link("beta", 1, false), link("gamma", 2)]);
    expect(moveSkillTo(rows, "gamma", "alpha")).toEqual([
      { skill_id: "gamma", enabled: true },
      { skill_id: "alpha", enabled: true },
      { skill_id: "beta", enabled: false },
    ]);
    expect(moveSkillTo(rows, "alpha", "alpha")).toEqual(toItems(rows));
    expect(moveSkillTo(rows, "delta", "alpha")).toEqual(toItems(rows));
  });

  it("filters by name without touching the order of the full list", () => {
    const rows = buildRows(SKILLS, LINKS);
    expect(filterRows(rows, "AL").map((r) => r.skill.id)).toEqual(["alpha"]);
    expect(filterRows(rows, "").length).toBe(4);
  });
});
