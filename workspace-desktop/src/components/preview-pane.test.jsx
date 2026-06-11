import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mockCommand, resetInvokeMocks } from "../test/tauri-mock";

vi.mock("@tauri-apps/api/core", () => import("../test/tauri-mock"));
vi.mock("@/lib/api", () => import("../test/tauri-mock"));

import { PreviewPane } from "./preview-pane";

describe("PreviewPane", () => {
  beforeEach(() => {
    resetInvokeMocks();
  });

  it("renders text files in a code block", async () => {
    mockCommand("read_file", {
      content: "console.log('hi');",
      truncated: false,
      binary: false,
    });

    render(<PreviewPane path="/proj/app.js" onClose={() => {}} />);

    await waitFor(() =>
      expect(screen.getByText("console.log('hi');")).toBeInTheDocument(),
    );
  });

  it("renders markdown files through the markdown renderer", async () => {
    mockCommand("read_file", {
      content: "# Quarterly Report",
      truncated: false,
      binary: false,
    });

    render(<PreviewPane path="/proj/report.md" onClose={() => {}} />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Quarterly Report" }),
      ).toBeInTheDocument(),
    );
  });

  it("shows a binary notice instead of content", async () => {
    mockCommand("read_file", { content: "", truncated: false, binary: true });

    render(<PreviewPane path="/proj/data.sqlite" onClose={() => {}} />);

    await waitFor(() =>
      expect(screen.getByText(/binary file/i)).toBeInTheDocument(),
    );
  });

  it("shows a truncation warning", async () => {
    mockCommand("read_file", {
      content: "partial…",
      truncated: true,
      binary: false,
    });

    render(<PreviewPane path="/proj/big.log" onClose={() => {}} />);

    await waitFor(() =>
      expect(screen.getByText(/truncated for preview/i)).toBeInTheDocument(),
    );
  });

  it("renders images via the file endpoint without reading the file", async () => {
    render(<PreviewPane path="/proj/chart.png" onClose={() => {}} />);

    // Outside Tauri, images are served through the API file endpoint. The
    // URL is resolved asynchronously, so wait for the src to be populated.
    const image = await screen.findByRole("img");
    expect(image).toHaveAttribute(
      "src",
      expect.stringContaining("/api/fs/file?path="),
    );
  });

  it("surfaces read errors", async () => {
    mockCommand("read_file", () => {
      throw new Error("permission denied");
    });

    render(<PreviewPane path="/proj/secret.txt" onClose={() => {}} />);

    await waitFor(() =>
      expect(screen.getByText(/permission denied/)).toBeInTheDocument(),
    );
  });

  it("invokes onClose from the header button", async () => {
    mockCommand("read_file", {
      content: "x",
      truncated: false,
      binary: false,
    });
    const onClose = vi.fn();

    render(<PreviewPane path="/proj/x.txt" onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Close preview" }));

    expect(onClose).toHaveBeenCalled();
  });
});
