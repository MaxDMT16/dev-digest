import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrFindingsSummary } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";
import { PrFindingsCell } from "./PrFindingsCell";

afterEach(cleanup);

const f = (id: string, severity: "CRITICAL" | "WARNING" | "SUGGESTION") => ({
  id,
  severity,
  title: `Title ${id}`,
  file: "src/a.ts",
  start_line: 3,
  end_line: 5,
});

function renderCell(summary?: PrFindingsSummary | null) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <PrFindingsCell summary={summary} />
    </NextIntlClientProvider>,
  );
}

describe("PrFindingsCell", () => {
  it("shows a dash when there is no summary or no findings", () => {
    const { unmount } = renderCell(null);
    expect(screen.getByText("—")).toBeTruthy();
    unmount();
    renderCell({ total: 0, counts: { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 }, preview: [] });
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("renders only non-zero severity marks with accessible labels", () => {
    renderCell({
      total: 3,
      counts: { CRITICAL: 2, WARNING: 0, SUGGESTION: 1 },
      preview: [f("1", "CRITICAL")],
    });
    expect(screen.getByLabelText("2 critical")).toBeTruthy();
    expect(screen.getByLabelText("1 suggestion")).toBeTruthy();
    expect(screen.queryByLabelText(/warning/)).toBeNull();
  });

  it("opens a popover with the total in the title and a +N more footer on hover", () => {
    const { container } = renderCell({
      total: 3,
      counts: { CRITICAL: 1, WARNING: 1, SUGGESTION: 1 },
      preview: [f("1", "CRITICAL"), f("2", "WARNING")],
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.mouseEnter(container.querySelector("[tabindex='0']")!);
    expect(screen.getByText("3 findings in this run")).toBeTruthy();
    expect(screen.getByText("Title 1")).toBeTruthy();
    expect(screen.getByText("Title 2")).toBeTruthy();
    expect(screen.getByText("+1 more")).toBeTruthy();
    expect(screen.getAllByText("src/a.ts:3-5")).toHaveLength(2);
  });

  it("uses the singular title for one finding", () => {
    const { container } = renderCell({
      total: 1,
      counts: { CRITICAL: 1, WARNING: 0, SUGGESTION: 0 },
      preview: [f("1", "CRITICAL")],
    });
    fireEvent.focus(container.querySelector("[tabindex='0']")!);
    expect(screen.getByText("1 finding in this run")).toBeTruthy();
  });
});
