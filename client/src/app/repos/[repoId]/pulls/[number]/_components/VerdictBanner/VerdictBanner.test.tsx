import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../messages/en/prReview.json";
import runsMessages from "../../../../../../../../messages/en/runs.json";
import { VerdictBanner } from "./VerdictBanner";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages, runs: runsMessages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("VerdictBanner (smoke)", () => {
  it("shows verdict label + score + finding/blocker counts", () => {
    renderWithIntl(
      <VerdictBanner
        verdict="request_changes"
        summary="Hardcoded secret introduced."
        score={42}
        findingsCount={1}
        blockers={1}
        agentName="Security Reviewer"
      />,
    );
    expect(screen.getByText("Request changes")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/1 findings · 1 blockers/)).toBeInTheDocument();
  });

  const base = {
    verdict: "comment" as const,
    summary: null,
    score: 80,
    findingsCount: 0,
    blockers: 0,
  };

  it("shows detailed cost badge under the score when usage is passed", () => {
    renderWithIntl(
      <VerdictBanner
        {...base}
        usage={{ cost_usd: 0.0137421, tokens_in: 8213, tokens_out: 1302, status: "done" }}
      />,
    );
    expect(screen.getByText(/\$0\.014/)).toBeInTheDocument();
    expect(screen.getByText(/8\.2K→1\.3K/)).toBeInTheDocument();
  });

  it("shows a dash when usage is null", () => {
    renderWithIntl(<VerdictBanner {...base} usage={null} />);
    expect(screen.getByLabelText("No cost data")).toHaveTextContent("—");
  });

  it("renders no badge when usage is omitted", () => {
    renderWithIntl(<VerdictBanner {...base} />);
    expect(screen.queryByLabelText("No cost data")).not.toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});
