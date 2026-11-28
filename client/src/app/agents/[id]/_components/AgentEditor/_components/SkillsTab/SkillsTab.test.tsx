import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent, AgentSkillLink, SkillListItem } from "@devdigest/shared";
import agentsMessages from "../../../../../../../../messages/en/agents.json";

const sk = (name: string, enabled = true): SkillListItem => ({
  id: name,
  name,
  description: "",
  type: "security",
  source: "manual",
  body: "b",
  enabled,
  version: 1,
  usage: { agent_count: 0, pull_rate: null, accept_rate: null },
});
const link = (skill_id: string, order: number, enabled = true): AgentSkillLink => ({
  agent_id: "ag1",
  skill_id,
  order,
  enabled,
});

const SKILLS = [sk("alpha"), sk("beta"), sk("gamma"), sk("offline", false)];
const LINKS = [link("gamma", 0), link("alpha", 1, false)];
const save = vi.fn();

vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useSkills: () => ({ data: SKILLS, isLoading: false, isError: false, refetch: vi.fn() }),
  useAgentSkills: () => ({ data: LINKS, isLoading: false, isError: false, refetch: vi.fn() }),
  useSetAgentSkills: () => ({ mutate: save }),
}));

import { SkillsTab } from "./SkillsTab";

afterEach(() => {
  cleanup();
  save.mockReset();
});

const AGENT = { id: "ag1", name: "Security Reviewer" } as Agent;

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: agentsMessages }}>
      <SkillsTab agent={AGENT} />
    </NextIntlClientProvider>,
  );
}

const row = (name: string) => screen.getByText(name).closest('[role="listitem"]') as HTMLElement;

describe("agent SkillsTab", () => {
  it("lists linked skills first, with the enabled count and the order hint", () => {
    renderTab();
    const names = screen.getAllByRole("listitem").map((el) => el.querySelector(".mono")?.textContent);
    expect(names).toEqual(["gamma", "alpha", "beta", "offline"]);
    expect(screen.getByText("1 of 4 enabled")).toBeInTheDocument();
    expect(screen.getByText(/Order matters/)).toBeInTheDocument();
  });

  it("marks a globally disabled skill as not injected", () => {
    renderTab();
    expect(within(row("offline")).getByText("disabled globally — not injected")).toBeInTheDocument();
  });

  it("checking an unlinked skill saves the full set with it appended and enabled", () => {
    renderTab();
    fireEvent.click(within(row("beta")).getByRole("checkbox"));
    expect(save).toHaveBeenCalledWith([
      { skill_id: "gamma", enabled: true },
      { skill_id: "alpha", enabled: false },
      { skill_id: "beta", enabled: true },
    ]);
  });

  it("unchecking a linked skill keeps its position and disables it", () => {
    renderTab();
    fireEvent.click(within(row("gamma")).getByRole("checkbox"));
    expect(save).toHaveBeenCalledWith([
      { skill_id: "gamma", enabled: false },
      { skill_id: "alpha", enabled: false },
    ]);
  });

  it("the move buttons reorder and the edges are no-ops", () => {
    renderTab();
    fireEvent.click(within(row("alpha")).getByLabelText("Move up: alpha"));
    expect(save).toHaveBeenLastCalledWith([
      { skill_id: "alpha", enabled: false },
      { skill_id: "gamma", enabled: true },
    ]);
    save.mockClear();
    fireEvent.click(within(row("gamma")).getByLabelText("Move up: gamma"));
    expect(save).not.toHaveBeenCalled();
    expect(within(row("beta")).queryByLabelText(/Move up/)).toBeNull();
  });

  it("dragging a linked skill onto another reorders", () => {
    renderTab();
    const data: Record<string, string> = {};
    const dataTransfer = {
      effectAllowed: "",
      setData: (k: string, v: string) => (data[k] = v),
      getData: (k: string) => data[k],
    };
    fireEvent.dragStart(row("alpha"), { dataTransfer });
    fireEvent.dragOver(row("gamma"), { dataTransfer });
    fireEvent.drop(row("gamma"), { dataTransfer });
    expect(save).toHaveBeenCalledWith([
      { skill_id: "alpha", enabled: false },
      { skill_id: "gamma", enabled: true },
    ]);
  });

  it("filters by name", () => {
    renderTab();
    fireEvent.change(screen.getByLabelText("Filter skills…"), { target: { value: "bet" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("gamma")).toBeNull();
  });
});
