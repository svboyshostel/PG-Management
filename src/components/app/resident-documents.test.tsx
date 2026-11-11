import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResidentDocuments } from "./resident-documents";
import { DOCUMENT_MAX_BYTES } from "@/lib/documents";

const uploadMock = vi.hoisted(() => vi.fn());
const listMock = vi.hoisted(() => vi.fn(async () => ({ documents: [], configured: true, migrated: true, legacyReference: false })));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));

vi.mock("@/lib/documents.functions", () => ({
  listResidentDocuments: (...args: unknown[]) => listMock(...(args as [])),
  uploadResidentDocument: (...args: unknown[]) => uploadMock(...(args as [])),
  getResidentDocumentUrl: vi.fn(),
  deleteResidentDocument: vi.fn(),
}));

describe("ResidentDocuments upload validation", () => {
  it("shows a clear 4 MB error message and blocks files over the limit", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ResidentDocuments residentId="00000000-0000-4000-8000-000000000001" />
      </QueryClientProvider>,
    );

    const fileInput = await screen.findByLabelText("Private ID file");
    const typeSelect = screen.getByLabelText("Document ID type");
    fireEvent.change(typeSelect, { target: { value: "aadhaar" } });

    const oversized = new File([new Uint8Array(DOCUMENT_MAX_BYTES + 1)], "oversize.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [oversized] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("4 MB");
    expect(uploadMock).not.toHaveBeenCalled();
  });
});

