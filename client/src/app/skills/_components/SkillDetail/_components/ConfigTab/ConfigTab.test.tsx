import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/skills.json";
import { ToastProvider } from "../../../../../../lib/toast";

const mutate = vi.fn();
vi.mock("../../../../../../lib/hooks/skills", () => ({
  useUpdateSkill: () => ({ mutate, isPending: false, isSuccess: false, data: undefined }),
}));

import { ConfigTab } from "./ConfigTab";

afterEach(() => {
  cleanup();
  mutate.mockReset();
});

const SKILL: Skill = {
  id: "s1",
  name: "pr-quality-rubric",
  description: "Apply when reviewing any PR.",
  type: "rubric",
  source: "manual",
  body: "# PR Quality Rubric\n\nBe concise.",
  enabled: true,
  version: 5,
};

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <ConfigTab skill={SKILL} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("skill ConfigTab", () => {
  it("tells the author the description is a directive interface", () => {
    renderTab();
    expect(screen.getByText(/Write it as a directive/)).toBeInTheDocument();
    expect(screen.getByText(/This is the skill's interface/)).toBeInTheDocument();
  });

  it("starts clean: no unsaved badge and Save is disabled", () => {
    renderTab();
    expect(screen.queryByText("unsaved")).toBeNull();
    expect(screen.getByRole("button", { name: /Save skill/ })).toBeDisabled();
    expect(screen.getByText("pr-quality-rubric.md")).toBeInTheDocument();
  });

  it("editing the body shows unsaved, the change note, and saves only what changed", () => {
    renderTab();
    const body = screen.getByDisplayValue(/PR Quality Rubric/);
    fireEvent.change(body, { target: { value: "# PR Quality Rubric\n\nBe very concise." } });
    expect(screen.getByText("unsaved")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("What changed? (optional)"), { target: { value: "Tightened" } });
    fireEvent.click(screen.getByRole("button", { name: /Save skill/ }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]![0]).toEqual({
      id: "s1",
      patch: { body: "# PR Quality Rubric\n\nBe very concise.", version_message: "Tightened" },
    });
  });

  it("rejects an invalid name and blocks saving", () => {
    renderTab();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Bad Name!" } });
    expect(screen.getByText(/Use lowercase letters, digits and dashes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save skill/ })).toBeDisabled();
  });

  it("a rename alone does not offer a change note (no new version)", () => {
    renderTab();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "renamed-rubric" } });
    expect(screen.queryByPlaceholderText("What changed? (optional)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Save skill/ }));
    expect(mutate.mock.calls[0]![0]).toEqual({ id: "s1", patch: { name: "renamed-rubric" } });
  });
});
