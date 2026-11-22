/**
 * RunHistory — the badge must reflect the review OUTCOME, not the run lifecycle.
 * Regression guard for the "green ✓ done on a run that found 5 blockers" bug:
 * a settled run is colored/labelled by its denormalized blocker/finding counts,
 * and shows the review score ring.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { RunSummary, FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";
import type { SeverityCounts } from "@/lib/findings";
import { RunHistory } from "./RunHistory";

afterEach(cleanup);

function run(o: Partial<RunSummary>): RunSummary {
  return {
    run_id: "run-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash",
    status: "done",
    error: null,
    duration_ms: 1000,
    tokens_in: 100,
    tokens_out: 50,
    cost_usd: null,
    findings_count: 0,
    grounding: "0/0 passed",
    ran_at: "2026-06-11T18:44:34.000Z",
    score: null,
    blockers: null,
    ...o,
  };
}

function renderRuns(runs: RunSummary[], severityByRun?: Map<string, SeverityCounts>) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <RunHistory runs={runs} onOpenTrace={() => {}} severityByRun={severityByRun} />
    </NextIntlClientProvider>,
  );
}

describe("RunHistory — outcome badge", () => {
  it("a done run WITH blockers reads 'rejected' (never green 'done') + shows the score ring", () => {
    renderRuns([run({ status: "done", findings_count: 5, blockers: 5, score: 0 })]);
    expect(screen.getByText("rejected")).toBeInTheDocument();
    expect(screen.queryByText("done")).not.toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument(); // CircularScore renders the number
    expect(screen.getByText(/5 blockers/)).toBeInTheDocument();
  });

  it("a clean done run reads 'approved'", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95 })]);
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("a done run with non-blocking findings reads 'reviewed'", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 0, score: 72 })]);
    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.queryByText(/blockers/)).not.toBeInTheDocument();
  });

  it("a failed run reads 'error'", () => {
    renderRuns([run({ status: "failed", error: "boom", score: null, blockers: null })]);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("a running run reads 'running'", () => {
    renderRuns([run({ status: "running", score: null, blockers: null })]);
    expect(screen.getByText("running")).toBeInTheDocument();
  });

  it("a done run shows total tokens and cost", () => {
    renderRuns([run({ tokens_in: 8000, tokens_out: 1119, cost_usd: 0.00134 })]);
    expect(screen.getByText(/9,119 tok/)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.0013/)).toBeInTheDocument();
  });

  it("a done run with tokens but null cost shows a dash", () => {
    renderRuns([run({ tokens_in: 8000, tokens_out: 1119, cost_usd: null })]);
    expect(screen.getByText(/9,119 tok · —/)).toBeInTheDocument();
  });

  it("a running run shows no tok line", () => {
    renderRuns([run({ status: "running", tokens_in: 8000, tokens_out: 1119, cost_usd: 0.5 })]);
    expect(screen.queryByText(/\d tok ·/)).not.toBeInTheDocument();
  });

  it("a failed run shows no cost", () => {
    renderRuns([run({ status: "failed", error: "boom", tokens_in: 10, tokens_out: 10, cost_usd: 0.5 })]);
    expect(screen.queryByText(/\d tok ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$0\.5/)).not.toBeInTheDocument();
  });
});

describe("RunHistory — severity marks", () => {
  it("shows only non-zero levels with correct numbers, replacing the findings text", () => {
    renderRuns(
      [run({ findings_count: 3, blockers: 2, score: 50 })],
      new Map([["run-1", { CRITICAL: 2, WARNING: 0, SUGGESTION: 1 }]]),
    );
    expect(screen.getByLabelText("2 critical")).toHaveTextContent("2");
    expect(screen.getByLabelText("1 suggestion")).toHaveTextContent("1");
    expect(screen.queryByLabelText(/warning/)).not.toBeInTheDocument();
    expect(screen.queryByText(/3 finding\(s\)/)).not.toBeInTheDocument();
    expect(screen.getByText(/2 blockers/)).toBeInTheDocument();
  });

  it("keeps the 'N findings' text when no entry exists for the run", () => {
    renderRuns([run({ findings_count: 3, blockers: 0 })], new Map());
    expect(screen.getByText(/3 finding\(s\)/)).toBeInTheDocument();
  });
});

function finding(o: Partial<FindingRecord>): FindingRecord {
  return {
    id: "f1",
    severity: "CRITICAL",
    category: "security",
    title: "SQL injection",
    file: "src/a.ts",
    start_line: 3,
    end_line: 5,
    confidence: 0.9,
    rationale: "Unsanitised **input**.",
    ...o,
  } as FindingRecord;
}

describe("RunHistory — findings modal", () => {
  const runs = [
    run({ run_id: "run-1", agent_name: "Security Reviewer", findings_count: 3, ran_at: "2026-06-11T18:44:34.000Z" }),
    run({ run_id: "run-2", agent_name: "Style Reviewer", findings_count: 1, ran_at: "2026-06-11T17:44:34.000Z" }),
  ];
  const sev = new Map([
    ["run-1", { CRITICAL: 2, WARNING: 1, SUGGESTION: 0 }],
    ["run-2", { CRITICAL: 1, WARNING: 0, SUGGESTION: 0 }],
  ]);
  const byRun = new Map([
    [
      "run-1",
      [
        finding({ id: "a", title: "Crit one" }),
        finding({ id: "b", title: "Crit two" }),
        finding({ id: "c", title: "Warn one", severity: "WARNING" }),
      ],
    ],
    ["run-2", [finding({ id: "d", title: "Other run crit" })]],
  ]);

  function setup(onGoToReview = vi.fn()) {
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <RunHistory
          runs={runs}
          onOpenTrace={() => {}}
          onGoToReview={onGoToReview}
          severityByRun={sev}
          findingsByRun={byRun}
        />
      </NextIntlClientProvider>,
    );
    return onGoToReview;
  }

  it("marks are buttons", () => {
    setup();
    expect(screen.getByRole("button", { name: "2 critical" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 warning" })).toBeInTheDocument();
  });

  it("opens a dialog with only that run's findings of that level", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "2 critical" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Security Reviewer · 2 Critical")).toBeInTheDocument();
    expect(within(dialog).getByText("Crit one")).toBeInTheDocument();
    expect(within(dialog).getByText("Crit two")).toBeInTheDocument();
    expect(within(dialog).queryByText("Warn one")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Other run crit")).not.toBeInTheDocument();
  });

  it("another run's mark shows that run's findings", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "1 critical" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Other run crit")).toBeInTheDocument();
    expect(within(dialog).queryByText("Crit one")).not.toBeInTheDocument();
  });

  it("'Go to review run' calls onGoToReview with the run id and closes", () => {
    const go = setup();
    fireEvent.click(screen.getByRole("button", { name: "1 warning" }));
    fireEvent.click(screen.getByRole("button", { name: "Go to review run" }));
    expect(go).toHaveBeenCalledWith("run-1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Close button and Esc close the dialog", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "2 critical" }));
    // Two close controls: the header X and the footer button.
    const closers = within(screen.getByRole("dialog")).getAllByRole("button", { name: "Close" });
    expect(closers).toHaveLength(2);
    fireEvent.click(closers[1]!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2 critical" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
