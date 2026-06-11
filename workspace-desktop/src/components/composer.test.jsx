import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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

describe("Composer slash menu", () => {
  const skills = [
    { name: "weekly-report", trigger_phrases: ["weekly report"] },
    { name: "retro", trigger_phrases: [] },
  ];

  it("opens the menu listing skills when '/' is typed", async () => {
    renderComposer({ skills });

    await userEvent.type(screen.getByRole("textbox"), "/");

    const menu = screen.getByRole("listbox");
    const items = within(menu).getAllByRole("option");
    expect(menu).toBeInTheDocument();
    const names = items.map((item) => item.textContent);
    expect(names.join(" ")).toContain("weekly-report");
    expect(names.join(" ")).toContain("retro");
    expect(names.join(" ")).toContain("compact");
  });

  it("does not open the menu for plain text", async () => {
    renderComposer({ skills });
    await userEvent.type(screen.getByRole("textbox"), "hello");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("filters commands as the user types", async () => {
    renderComposer({ skills });

    await userEvent.type(screen.getByRole("textbox"), "/wee");

    const items = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain("weekly-report");
  });

  it("autocompletes on click without sending", async () => {
    const props = renderComposer({ skills });
    const textbox = screen.getByRole("textbox");

    await userEvent.type(textbox, "/wee");
    await userEvent.click(screen.getByRole("option", { name: /weekly-report/ }));

    expect(textbox).toHaveValue("/weekly-report ");
    expect(props.onSendPrompt).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("selects the highlighted command with Enter instead of sending", async () => {
    const props = renderComposer({ skills });
    const textbox = screen.getByRole("textbox");

    await userEvent.type(textbox, "/wee");
    await userEvent.keyboard("{Enter}");

    expect(textbox).toHaveValue("/weekly-report ");
    expect(props.onSendPrompt).not.toHaveBeenCalled();
  });

  it("navigates with arrow keys", async () => {
    renderComposer({ skills });
    const textbox = screen.getByRole("textbox");

    await userEvent.type(textbox, "/");
    await userEvent.keyboard("{ArrowDown}{Enter}");

    // Second command in the list: built-ins come first (compact, schedule).
    expect(textbox).toHaveValue("/schedule ");
  });

  it("closes the menu with Escape and lets Enter send again", async () => {
    const props = renderComposer({ skills });
    const textbox = screen.getByRole("textbox");

    await userEvent.type(textbox, "/wee");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    expect(props.onSendPrompt).toHaveBeenCalledWith("/wee");
  });
});
