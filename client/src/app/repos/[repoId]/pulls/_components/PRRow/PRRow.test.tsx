import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta } from "@/lib/types";
import messages from "../../../../../../../messages/en/prReview.json";
import runsMessages from "../../../../../../../messages/en/runs.json";
import { PRRow } from "./PRRow";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

function pr(o: Partial<PrMeta>): PrMeta {
  return {
    number: 7,
    title: "Fix thing",
    author: "ann",
    branch: "fix",
    base: "main",
    head_sha: "abc",
    additions: 10,
    deletions: 2,
    files_count: 1,
    status: "needs_review",
    updated_at: "2026-06-11T18:44:34.000Z",
    ...o,
  } as PrMeta;
}

function renderRow(p: PrMeta) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages, runs: runsMessages }}>
      <PRRow pr={p} repoId="r1" />
    </NextIntlClientProvider>,
  );
}

const usage = (o: Record<string, number | null>) => ({
  cost_usd: 0.0123,
  tokens_in: 8213,
  tokens_out: 1302,
  runs: 3,
  runs_without_cost: 0,
  ...o,
});

describe("PRRow — cost cell", () => {
  it("shows the total cost with a tooltip", () => {
    renderRow(pr({ usage_total: usage({}) }));
    expect(screen.getByText("$0.012")).toBeInTheDocument();
    expect(screen.getByTitle("Total for 3 runs · 8.2K→1.3K tokens")).toBeInTheDocument();
  });

  it("prefixes ≥ when some runs lack cost", () => {
    renderRow(pr({ usage_total: usage({ runs_without_cost: 1 }) }));
    expect(screen.getByText("≥$0.012")).toBeInTheDocument();
  });

  it("shows a dash without usage_total", () => {
    renderRow(pr({ usage_total: null }));
    expect(screen.getByLabelText("No cost data")).toHaveTextContent("—");
  });
});
