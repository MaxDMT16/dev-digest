import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../messages/en/prReview.json";
import { SeverityCounters } from "./SeverityCounters";

afterEach(cleanup);

function setup(active: "CRITICAL" | "WARNING" | "SUGGESTION" | null = null) {
  const onSelect = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <SeverityCounters
        counts={{ CRITICAL: 2, WARNING: 0, SUGGESTION: 5 }}
        active={active}
        onSelect={onSelect}
      />
    </NextIntlClientProvider>,
  );
  return onSelect;
}

describe("SeverityCounters", () => {
  it("shows all three counts including zero, with separators", () => {
    setup();
    expect(screen.getByText("2 CRITICAL")).toBeInTheDocument();
    expect(screen.getByText("0 WARNING")).toBeInTheDocument();
    expect(screen.getByText("5 SUGGESTIONS")).toBeInTheDocument();
    expect(screen.getAllByText("·")).toHaveLength(2);
  });

  it("marks only the active level as pressed", () => {
    setup("WARNING");
    const pressed = screen.getAllByRole("button").map((b) => b.getAttribute("aria-pressed"));
    expect(pressed).toEqual(["false", "true", "false"]);
  });

  it("selects an inactive level on click", () => {
    const onSelect = setup();
    fireEvent.click(screen.getByText("2 CRITICAL"));
    expect(onSelect).toHaveBeenCalledWith("CRITICAL");
  });

  it("clears when the active level is clicked", () => {
    const onSelect = setup("SUGGESTION");
    fireEvent.click(screen.getByText("5 SUGGESTIONS"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("switches directly to another level", () => {
    const onSelect = setup("SUGGESTION");
    fireEvent.click(screen.getByText("2 CRITICAL"));
    expect(onSelect).toHaveBeenCalledWith("CRITICAL");
  });
});
