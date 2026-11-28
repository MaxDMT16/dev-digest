import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { SkillImportPreview } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { ToastProvider } from "../../../../lib/toast";

const PREVIEW: SkillImportPreview = {
  draft: {
    name: "imported-one",
    description: "Apply to auth code.",
    type: "security",
    body: "# Imported\nCheck auth.",
  },
  files: {
    used: "SKILL.md",
    ignored: [{ path: "scripts/install.sh", reason: "executable_not_processed" }],
  },
  warnings: [{ code: "external_url", message: "References external URLs." }],
};

const previewMutate = vi.fn((_req: unknown, opts?: { onSuccess?: (p: SkillImportPreview) => void }) =>
  opts?.onSuccess?.(PREVIEW),
);
const importMutate = vi.fn();
vi.mock("../../../../lib/hooks/skills", () => ({
  useImportPreview: () => ({ mutate: previewMutate, reset: vi.fn(), isPending: false, isError: false, error: null }),
  useImportSkill: () => ({ mutate: importMutate, isPending: false, isError: false, error: null }),
}));

import { ImportSkillDrawer } from "./ImportSkillDrawer";

afterEach(() => {
  cleanup();
  previewMutate.mockClear();
  importMutate.mockReset();
});

function renderDrawer(onImported = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <ImportSkillDrawer onClose={() => {}} onImported={onImported} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return onImported;
}

async function pickFile(name = "pack.zip", content = "x") {
  const input = screen.getByLabelText("Choose a file", { selector: "input" }) as HTMLInputElement;
  const file = new File([content], name);
  // jsdom's File may not implement arrayBuffer(); the component only needs the bytes.
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new TextEncoder().encode(content).buffer,
  });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(previewMutate).toHaveBeenCalled());
}

describe("ImportSkillDrawer", () => {
  it("starts at the file picker and saves nothing", () => {
    renderDrawer();
    expect(screen.getByText(".md, .zip or .skill, up to 1 MB")).toBeInTheDocument();
    expect(previewMutate).not.toHaveBeenCalled();
    expect(importMutate).not.toHaveBeenCalled();
  });

  it("a picked file is only PARSED; the review shows what was and was not used", async () => {
    renderDrawer();
    await pickFile();

    expect(previewMutate.mock.calls[0]![0]).toEqual({ filename: "pack.zip", content_base64: btoa("x") });
    expect(await screen.findByText(/Imported skills are someone else's instructions/)).toBeInTheDocument();
    expect(screen.getByText("SKILL.md")).toBeInTheDocument();
    expect(screen.getByText("scripts/install.sh")).toBeInTheDocument();
    expect(screen.getByText(/script — not processed/)).toBeInTheDocument();
    expect(screen.getByText("References external URLs.")).toBeInTheDocument();
    // Still nothing persisted.
    expect(importMutate).not.toHaveBeenCalled();
  });

  it("saves only when Import is pressed, with the (editable) draft and the file source", async () => {
    const onImported = renderDrawer();
    await pickFile();
    await screen.findByText(/Imported skills are someone else's instructions/);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "renamed-import" } });
    fireEvent.click(screen.getByRole("button", { name: /Import \(saved disabled\)/ }));

    expect(importMutate).toHaveBeenCalledTimes(1);
    const [payload, opts] = importMutate.mock.calls[0]!;
    expect(payload).toEqual({
      draft: { ...PREVIEW.draft, name: "renamed-import" },
      source: "imported_file",
    });
    opts.onSuccess({ id: "new1", name: "renamed-import" });
    expect(onImported).toHaveBeenCalledWith("new1");
  });

  it("refuses files over 1 MB without calling the server", async () => {
    renderDrawer();
    const input = screen.getByLabelText("Choose a file", { selector: "input" }) as HTMLInputElement;
    const big = new File(["x"], "big.zip");
    Object.defineProperty(big, "size", { value: 1_000_001 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("The file is larger than 1 MB.");
    expect(previewMutate).not.toHaveBeenCalled();
  });
});
