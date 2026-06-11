import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Composer } from "./composer";

function renderComposer(overrides = {}) {
  const props = {
    pendingContextPath: null,
    onContextInjected: vi.fn(),
    isStreaming: false,
    onSendPrompt: vi.fn(),
    onUserMessage: vi.fn(),
    onAddToContext: vi.fn(),
    agents: [
      { name: "hermes", binary: "/usr/bin/hermes", version: "1.0" },
      { name: "ollama", binary: "/usr/bin/ollama", version: "0.30" },
    ],
    activeAgent: "hermes",
    onAgentChange: vi.fn(),
    activeModel: "deepseek/deepseek-v4-flash",
    onModelChange: vi.fn(),
    models: ["deepseek/deepseek-v4-flash", "anthropic/claude-sonnet-4"],
    ...overrides,
  };

  render(<Composer {...props} />);
  return props;
}

describe("Composer", () => {
  it("submits prompt on Enter", async () => {
    const props = renderComposer();

    await userEvent.type(screen.getByRole("textbox"), "hello world");
    await userEvent.keyboard("{Enter}");

    expect(props.onUserMessage).toHaveBeenCalled();
    expect(props.onSendPrompt).toHaveBeenCalledWith("hello world");
  });

  it("disables input while streaming", () => {
    renderComposer({ isStreaming: true });
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("shows context badge when pendingContextPath is set", () => {
    renderComposer({ pendingContextPath: "/proj/src/main.rs" });
    expect(screen.getByText(/main\.rs/)).toBeInTheDocument();
  });

  it("accepts drag-and-drop of workspace files", () => {
    const props = renderComposer();

    // The outermost <div> in Composer has the drop handlers
    // It's the container with the border-t class
    const dropTarget = screen.getByRole("textbox").closest(
      "[class*='border-t']",
    );

    // Build a mock data store like DataTransfer
    const data = { "application/x-workspace-file": "/proj/readme.md" };
    const dataTransfer = {
      types: Object.keys(data),
      getData: (type) => data[type] ?? "",
      dropEffect: "none",
    };

    fireEvent.dragOver(dropTarget, { dataTransfer });
    fireEvent.drop(dropTarget, { dataTransfer });

    expect(props.onAddToContext).toHaveBeenCalledWith("/proj/readme.md");
  });

  it("renders agent selector with all agents", () => {
    renderComposer();
    const select = screen.getAllByRole("combobox")[0];
    expect(select).toBeInTheDocument();
    // Should have hermes and ollama options
    const options = select.querySelectorAll("option");
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toBe("hermes");
    expect(options[1].textContent).toBe("ollama");
  });

  it("renders model selector with model list", () => {
    renderComposer();
    const selects = screen.getAllByRole("combobox");
    const modelSelect = selects[1];
    const options = modelSelect.querySelectorAll("option");
    expect(options).toHaveLength(2);
  });
});
