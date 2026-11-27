import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../messages/en/runs.json";
import { RunCostBadge, type RunCostBadgeProps } from "./RunCostBadge";

afterEach(cleanup);

function renderBadge(props: RunCostBadgeProps) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ runs: messages }}>
      <div data-testid="c">
        <RunCostBadge {...props} />
      </div>
    </NextIntlClientProvider>,
  );
}

const text = () => screen.getByTestId("c").textContent ?? "";
const DASH = "—";

describe("RunCostBadge", () => {
  it("compact shows the cost", () => {
    renderBadge({ variant: "compact", costUsd: 0.0123 });
    expect(text()).toBe("$0.012");
  });

  it("compact partial prefixes ≥", () => {
    renderBadge({ variant: "compact", costUsd: 0.0123, partial: true });
    expect(text()).toBe("≥$0.012");
  });

  it("detailed shows tokens and precise label", () => {
    renderBadge({
      variant: "detailed",
      costUsd: 0.0137421,
      tokensIn: 8213,
      tokensOut: 1302,
      status: "done",
    });
    expect(text()).toContain("$0.014");
    expect(text()).toContain("8.2K→1.3K");
    expect(screen.getByLabelText("$0.0137421 · 8,213 in / 1,302 out")).toBeInTheDocument();
  });

  it("null cost renders dash with no-data label", () => {
    renderBadge({ variant: "compact", costUsd: null });
    expect(text()).toBe(DASH);
    expect(screen.getByLabelText("No cost data")).toBeInTheDocument();
  });

  it.each(["running", "failed", "cancelled"])("status %s renders dash", (status) => {
    renderBadge({ variant: "detailed", costUsd: 0.5, tokensIn: 10, tokensOut: 10, status });
    expect(text()).toContain(DASH);
    expect(text()).not.toContain("0.5");
    expect(text()).not.toContain("→");
  });

  it("never renders $0.00", () => {
    for (const costUsd of [null, undefined, 0, 0.00001, 0.009996]) {
      renderBadge({ variant: "detailed", costUsd });
      expect(text()).not.toMatch(/\$0\.00(?!\d)/);
      cleanup();
    }
  });
});
