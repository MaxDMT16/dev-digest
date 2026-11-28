import { describe, it, expect } from "vitest";
import { NAV, SHORTCUTS, resolveHref } from "@devdigest/ui";
import { activeKeyFor } from "./helpers";

describe("Skills Lab navigation", () => {
  const items = NAV.flatMap((g) => g.items);

  it("has a SKILLS LAB group with Skills and Agents", () => {
    const lab = NAV.find((g) => g.section === "SKILLS LAB");
    expect(lab?.items.map((i) => i.key)).toEqual(["skills", "agents"]);
  });

  it("Skills routes to /skills with the g s shortcut, and g a still goes to Agents", () => {
    expect(items.find((i) => i.key === "skills")).toMatchObject({ href: "/skills", gKey: "s" });
    expect(items.find((i) => i.key === "agents")).toMatchObject({ href: "/agents", gKey: "a" });
    expect(resolveHref("/skills", null)).toBe("/skills");
  });

  it("every g-key is unique", () => {
    const keys = items.map((i) => i.gKey).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("lists the shortcut in help and highlights the sidebar item for /skills routes", () => {
    expect(SHORTCUTS.some((s) => s.keys === "g s" && s.label === "Go to Skills")).toBe(true);
    expect(activeKeyFor("/skills")).toBe("skills");
    expect(activeKeyFor("/skills/abc?tab=preview")).toBe("skills");
  });
});
