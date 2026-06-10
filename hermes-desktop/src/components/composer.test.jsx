import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Composer } from "./composer";

function renderComposer(overrides = {}) {
  const props = {
    pendingContextPath: null,
    onContextInjected: vi.fn(),
    isStreaming: false,
    send: vi.fn(),
    activeSessionId: "sess-1",
    onUserMessage: vi.fn(),
    mode: "ask",
    onModeChange: vi.fn(),
    skills: [],
    onCompact: vi.fn(),
    onOpenSchedule: vi.fn(),
    ...overrides,
  };

  render(<Composer {...props} />);
  return props;
}

describe("Composer", () => {
  it("submits prompts with the selected permission mode", async () => {
    const props = renderComposer({ mode: "auto" });

    await userEvent.type(screen.getByRole("textbox"), "summarize the folder");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(props.send).toHaveBeenCalledWith("prompt.submit", {
      text: "summarize the folder",
      session_id: "sess-1",
      mode: "auto",
    });
    expect(props.onUserMessage).toHaveBeenCalled();
  });

  it("steers instead of submitting while streaming", async () => {
    const props = renderComposer({ isStreaming: true });

    await userEvent.type(screen.getByRole("textbox"), "skip the appendix");
    await userEvent.click(screen.getByRole("button", { name: "Steer" }));

    expect(props.send).toHaveBeenCalledWith("prompt.steer", {
      text: "skip the appendix",
      session_id: "sess-1",
    });
  });

  it("shows a stop button while streaming that cancels the prompt", async () => {
    const props = renderComposer({ isStreaming: true });

    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(props.send).toHaveBeenCalledWith("prompt.cancel", {
      session_id: "sess-1",
    });
  });

  it("hides the stop button when idle", () => {
    renderComposer({ isStreaming: false });
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
  });

  it("opens the slash menu on / and filters by prefix", async () => {
    renderComposer({ skills: [{ name: "weekly-report" }] });

    await userEvent.type(screen.getByRole("textbox"), "/");
    expect(screen.getByTestId("slash-menu")).toBeInTheDocument();
    expect(screen.getByText("/compact")).toBeInTheDocument();
    expect(screen.getByText("/weekly-report")).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox"), "we");
    expect(screen.queryByText("/compact")).not.toBeInTheDocument();
    expect(screen.getByText("/weekly-report")).toBeInTheDocument();
  });

  it("runs /compact via the menu", async () => {
    const props = renderComposer();

    await userEvent.type(screen.getByRole("textbox"), "/com");
    await userEvent.click(screen.getByText("/compact"));

    expect(props.onCompact).toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("runs /schedule typed directly", async () => {
    const props = renderComposer();

    await userEvent.type(screen.getByRole("textbox"), "/schedule{Enter}");
    expect(props.onOpenSchedule).toHaveBeenCalled();
    expect(props.send).not.toHaveBeenCalled();
  });

  it("completes skill commands into the input", async () => {
    renderComposer({ skills: [{ name: "weekly-report" }] });

    await userEvent.type(screen.getByRole("textbox"), "/wee");
    await userEvent.click(screen.getByText("/weekly-report"));

    expect(screen.getByRole("textbox")).toHaveValue("/weekly-report ");
  });

  it("changes permission mode from the selector", async () => {
    const props = renderComposer();

    await userEvent.click(screen.getByRole("radio", { name: "Auto" }));
    expect(props.onModeChange).toHaveBeenCalledWith("auto");
  });
});
