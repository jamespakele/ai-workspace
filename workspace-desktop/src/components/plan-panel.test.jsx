import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PlanPanel } from "./plan-panel";

const plan = {
  steps: [
    { id: "1", title: "Read the spreadsheet", status: "done" },
    { id: "2", title: "Summarize quarterly numbers", status: "running" },
    { id: "3", title: "Write the report", status: "pending" },
  ],
};

describe("PlanPanel", () => {
  it("renders nothing without steps", () => {
    const { container } = render(<PlanPanel plan={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders every step with progress count", () => {
    render(<PlanPanel plan={plan} />);

    expect(screen.getByText("Read the spreadsheet")).toBeInTheDocument();
    expect(screen.getByText("Summarize quarterly numbers")).toBeInTheDocument();
    expect(screen.getByText("Write the report")).toBeInTheDocument();
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
  });

  it("collapses and expands on header click", async () => {
    render(<PlanPanel plan={plan} />);

    await userEvent.click(screen.getByRole("button", { name: /plan/i }));
    expect(screen.queryByText("Read the spreadsheet")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /plan/i }));
    expect(screen.getByText("Read the spreadsheet")).toBeInTheDocument();
  });

  it("shows completion marker when all steps are done", () => {
    render(
      <PlanPanel
        plan={{
          steps: [
            { id: "1", title: "a", status: "done" },
            { id: "2", title: "b", status: "done" },
          ],
        }}
      />,
    );
    expect(screen.getByText(/2\/2 ✓/)).toBeInTheDocument();
  });
});
