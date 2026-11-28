import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { SkillListItem } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";

const deleteMutate = vi.fn();
vi.mock("../../../../lib/hooks/skills", () => ({
  useDeleteSkill: () => ({ mutate: deleteMutate, isPending: false }),
}));

import { SkillCard } from "./SkillCard";

afterEach(() => {
  cleanup();
  deleteMutate.mockReset();
  vi.restoreAllMocks();
});

const SKILL: SkillListItem = {
  id: "s1",
  name: "pr-quality-rubric",
  description: "Rubric for evaluating overall PR quality.",
  type: "rubric",
  source: "manual",
  body: "# Rubric",
  enabled: true,
  version: 5,
  usage: { agent_count: 3, pull_rate: 0.71, accept_rate: 0.74 },
};

function renderCard(props: Partial<React.ComponentProps<typeof SkillCard>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <SkillCard skill={SKILL} {...props} />
    </NextIntlClientProvider>,
  );
}

describe("SkillCard", () => {
  it("shows name, type, source, description and the usage footer", () => {
    renderCard();
    expect(screen.getByText("pr-quality-rubric")).toBeInTheDocument();
    expect(screen.getByText("rubric")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("Rubric for evaluating overall PR quality.")).toBeInTheDocument();
    expect(screen.getByText("3 agents")).toBeInTheDocument();
    expect(screen.getByText("71% pull")).toBeInTheDocument();
    expect(screen.getByText("74% accept")).toBeInTheDocument();
  });

  it("hides rates that have no data yet", () => {
    renderCard({ skill: { ...SKILL, usage: { agent_count: 1, pull_rate: null, accept_rate: null } } });
    expect(screen.getByText("1 agent")).toBeInTheDocument();
    expect(screen.queryByText(/% pull/)).toBeNull();
    expect(screen.queryByText(/% accept/)).toBeNull();
  });

  it("the toggle saves without opening the card", () => {
    const onClick = vi.fn();
    const onToggle = vi.fn();
    renderCard({ onClick, onToggle });
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("clicking the card opens it", () => {
    const onClick = vi.fn();
    renderCard({ onClick });
    fireEvent.click(screen.getByText("pr-quality-rubric"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("delete asks for confirmation (with the agent count) and only then deletes", () => {
    const onClick = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderCard({ onClick });
    fireEvent.click(screen.getByLabelText("Delete skill"));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(String(confirm.mock.calls[0]![0])).toContain("3 agents");
    expect(deleteMutate).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByLabelText("Delete skill"));
    expect(deleteMutate).toHaveBeenCalledWith("s1", expect.anything());
  });
});
