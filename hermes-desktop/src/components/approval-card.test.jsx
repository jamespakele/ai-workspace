import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApprovalCard } from "./approval-card";

const request = {
  request_id: "req-1",
  tool_name: "bash",
  args: { command: "rm old-report.md" },
};

describe("ApprovalCard", () => {
  it("shows the tool name and its arguments", () => {
    render(<ApprovalCard request={request} onRespond={() => {}} />);

    expect(screen.getByText("bash")).toBeInTheDocument();
    expect(screen.getByText(/rm old-report\.md/)).toBeInTheDocument();
  });

  it.each([
    ["Allow once", "allow_once"],
    ["Allow for session", "allow_session"],
    ["Deny", "deny"],
  ])("responds with %s decision", async (label, decision) => {
    const onRespond = vi.fn();
    render(<ApprovalCard request={request} onRespond={onRespond} />);

    await userEvent.click(screen.getByRole("button", { name: label }));
    expect(onRespond).toHaveBeenCalledWith(request, decision);
  });
});
