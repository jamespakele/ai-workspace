import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OutputsPanel } from "./outputs-panel";

describe("OutputsPanel", () => {
  it("shows an empty state", () => {
    render(<OutputsPanel outputs={[]} onOpen={() => {}} />);
    expect(screen.getByText(/will appear here/i)).toBeInTheDocument();
  });

  it("lists output files with name and full path", () => {
    render(
      <OutputsPanel
        outputs={["/proj/report.md", "/proj/data/summary.csv"]}
        onOpen={() => {}}
      />,
    );

    expect(screen.getByText("report.md")).toBeInTheDocument();
    expect(screen.getByText("summary.csv")).toBeInTheDocument();
    expect(screen.getByText("/proj/data/summary.csv")).toBeInTheDocument();
  });

  it("opens a file on click", async () => {
    const onOpen = vi.fn();
    render(<OutputsPanel outputs={["/proj/report.md"]} onOpen={onOpen} />);

    await userEvent.click(screen.getByText("report.md"));
    expect(onOpen).toHaveBeenCalledWith("/proj/report.md");
  });
});
