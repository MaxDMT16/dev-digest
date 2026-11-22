import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

const mutate = vi.fn();
vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate, isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mutate.mockClear();
});

const FINDINGS: FindingRecord[] = [
  {
    id: "f1",
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded secret",
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "A secret is committed.",
    suggestion: null,
    confidence: 0.95,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
  },
];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });
});

const mk = (
  id: string,
  severity: FindingRecord["severity"],
  confidence: number,
  extra: Partial<FindingRecord> = {},
): FindingRecord => ({ ...FINDINGS[0]!, id, severity, confidence, title: `T-${id}`, ...extra });

const MIXED: FindingRecord[] = [
  mk("c1", "CRITICAL", 0.9),
  mk("c2", "CRITICAL", 0.3),
  mk("w1", "WARNING", 0.8),
  mk("s1", "SUGGESTION", 0.9),
  mk("s2", "SUGGESTION", 0.2),
  mk("s3", "SUGGESTION", 0.7),
];

const pressed = () =>
  screen
    .getAllByRole("button", { pressed: true })
    .map((b) => b.textContent)
    .filter((x) => /CRITICAL|WARNING|SUGGESTIONS/.test(x ?? ""));

describe("FindingsPanel severity counters", () => {
  it("shows counts matching the list, zeros included", () => {
    renderWithIntl(<FindingsPanel findings={[FINDINGS[0]!]} prId="pr1" />);
    expect(screen.getByText("1 CRITICAL")).toBeInTheDocument();
    expect(screen.getByText("0 WARNING")).toBeInTheDocument();
    expect(screen.getByText("0 SUGGESTIONS")).toBeInTheDocument();
  });

  it("filters to one level on click and restores on second click", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    expect(screen.getByText("2 CRITICAL")).toBeInTheDocument();
    expect(screen.getByText("1 WARNING")).toBeInTheDocument();
    expect(screen.getByText("3 SUGGESTIONS")).toBeInTheDocument();
    expect(screen.getAllByText(/^T-/)).toHaveLength(6);

    fireEvent.click(screen.getByText("1 WARNING"));
    expect(screen.getAllByText(/^T-/).map((e) => e.textContent)).toEqual(["T-w1"]);

    fireEvent.click(screen.getByText("1 WARNING"));
    expect(screen.getAllByText(/^T-/)).toHaveLength(6);
  });

  it("is single-select: switching level moves aria-pressed", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(screen.getByText("2 CRITICAL"));
    expect(pressed()).toEqual(["2 CRITICAL"]);
    fireEvent.click(screen.getByText("3 SUGGESTIONS"));
    expect(pressed()).toEqual(["3 SUGGESTIONS"]);
    expect(screen.getAllByText(/^T-/)).toHaveLength(3);
  });

  it("shows the empty state when clicking a level with 0 findings", () => {
    renderWithIntl(<FindingsPanel findings={[FINDINGS[0]!]} prId="pr1" />);
    fireEvent.click(screen.getByText("0 WARNING"));
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });

  it("computes counts after the confidence filter and combines both filters", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByText("1 CRITICAL")).toBeInTheDocument();
    expect(screen.getByText("1 WARNING")).toBeInTheDocument();
    expect(screen.getByText("2 SUGGESTIONS")).toBeInTheDocument();

    fireEvent.click(screen.getByText("2 SUGGESTIONS"));
    expect(screen.getAllByText(/^T-/).map((e) => e.textContent)).toEqual(["T-s1", "T-s3"]);
  });

  it("keeps counts equal to the list after a finding is dismissed (props change)", () => {
    const ui = (list: FindingRecord[]) => (
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <FindingsPanel findings={list} prId="pr1" />
      </NextIntlClientProvider>
    );
    const { rerender } = render(ui(MIXED));
    expect(screen.getByText("3 SUGGESTIONS")).toBeInTheDocument();
    rerender(ui(MIXED.filter((f) => f.id !== "s1")));
    expect(screen.getByText("2 SUGGESTIONS")).toBeInTheDocument();
    expect(screen.getAllByText(/^T-/)).toHaveLength(5);
  });

  it("does not hit the network or mutate when clicking counters", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(screen.getByText("2 CRITICAL"));
    fireEvent.click(screen.getByText("2 CRITICAL"));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
