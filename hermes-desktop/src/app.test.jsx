import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mockCommand, resetInvokeMocks } from "./test/tauri-mock";

vi.mock("@tauri-apps/api/core", () => import("./test/tauri-mock"));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

import App from "./app";

class FakeWebSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.sent = [];
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  receive(payload) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  send(data) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }
}

FakeWebSocket.CONNECTING = 0;
FakeWebSocket.OPEN = 1;
FakeWebSocket.CLOSING = 2;
FakeWebSocket.CLOSED = 3;

async function renderApp() {
  render(<App />);
  await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
  const socket = FakeWebSocket.instances[0];
  act(() => socket.open());
  await waitFor(() => expect(screen.getByText(/gateway connected/)).toBeInTheDocument());
  return socket;
}

describe("App integration", () => {
  beforeEach(() => {
    resetInvokeMocks();
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);

    mockCommand("get_config", {
      gateway_url: "ws://localhost:8765",
      auto_start_gateway: false,
      active_project: "",
      context_window: null,
    });
    mockCommand("list_sessions", []);
    mockCommand("list_projects", []);
    mockCommand("list_skills", []);
    mockCommand("list_scheduled_tasks", []);
    mockCommand("save_scheduled_tasks", () => {});
    mockCommand("list_mcp_servers", []);
  });

  it("shows an approval card for permission requests in ask mode and responds", async () => {
    const socket = await renderApp();

    act(() =>
      socket.receive({
        event: "permission.request",
        data: {
          request_id: "req-1",
          tool_name: "bash",
          args: { command: "rm draft.md" },
        },
      }),
    );

    const card = await screen.findByTestId("approval-card");
    expect(card).toHaveTextContent("bash");

    await userEvent.click(screen.getByRole("button", { name: "Allow once" }));

    expect(socket.sent).toContainEqual({
      method: "permission.respond",
      params: { request_id: "req-1", decision: "allow_once" },
    });
    expect(screen.queryByTestId("approval-card")).not.toBeInTheDocument();
  });

  it("auto-approves permission requests in auto mode", async () => {
    const socket = await renderApp();

    await userEvent.click(screen.getByRole("radio", { name: "Auto" }));

    act(() =>
      socket.receive({
        event: "permission.request",
        data: { request_id: "req-2", tool_name: "bash", args: {} },
      }),
    );

    await waitFor(() =>
      expect(socket.sent).toContainEqual({
        method: "permission.respond",
        params: { request_id: "req-2", decision: "allow_once" },
      }),
    );
    expect(screen.queryByTestId("approval-card")).not.toBeInTheDocument();
  });

  it("auto-approves tools allowed for the session", async () => {
    const socket = await renderApp();

    act(() =>
      socket.receive({
        event: "permission.request",
        data: { request_id: "req-3", tool_name: "write_file", args: {} },
      }),
    );
    await screen.findByTestId("approval-card");
    await userEvent.click(
      screen.getByRole("button", { name: "Allow for session" }),
    );

    act(() =>
      socket.receive({
        event: "permission.request",
        data: { request_id: "req-4", tool_name: "write_file", args: {} },
      }),
    );

    await waitFor(() =>
      expect(socket.sent).toContainEqual({
        method: "permission.respond",
        params: { request_id: "req-4", decision: "allow_once" },
      }),
    );
    expect(screen.queryByTestId("approval-card")).not.toBeInTheDocument();
  });

  it("renders plan updates as progress steps", async () => {
    const socket = await renderApp();

    act(() =>
      socket.receive({
        event: "plan.update",
        data: {
          steps: [
            { id: "1", title: "Scan the folder", status: "done" },
            { id: "2", title: "Draft the summary", status: "running" },
          ],
        },
      }),
    );

    expect(await screen.findByTestId("plan-panel")).toBeInTheDocument();
    expect(screen.getByText("Scan the folder")).toBeInTheDocument();
    expect(screen.getByText("Draft the summary")).toBeInTheDocument();
  });

  it("collects files written by tools into the Outputs tab", async () => {
    const socket = await renderApp();

    act(() => {
      socket.receive({
        event: "message.delta",
        data: { delta: "Working…", message_id: "m1" },
      });
      socket.receive({
        event: "tool.start",
        data: {
          tool_call_id: "t1",
          tool_name: "write_file",
          args: { path: "/proj/report.md" },
        },
      });
      socket.receive({
        event: "tool.complete",
        data: { tool_call_id: "t1", result: "ok" },
      });
    });

    await userEvent.click(screen.getByRole("tab", { name: "Outputs" }));
    expect(await screen.findByText("report.md")).toBeInTheDocument();
  });

  it("opens the preview pane from an output file", async () => {
    mockCommand("read_file", {
      content: "# Report",
      truncated: false,
      binary: false,
    });
    const socket = await renderApp();

    act(() => {
      socket.receive({
        event: "message.delta",
        data: { delta: "x", message_id: "m1" },
      });
      socket.receive({
        event: "tool.start",
        data: {
          tool_call_id: "t1",
          tool_name: "write_file",
          args: { path: "/proj/report.md" },
        },
      });
      socket.receive({
        event: "tool.complete",
        data: { tool_call_id: "t1", result: "ok" },
      });
    });

    await userEvent.click(screen.getByRole("tab", { name: "Outputs" }));
    await userEvent.click(await screen.findByText("report.md"));

    expect(await screen.findByTestId("preview-pane")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Report" }),
    ).toBeInTheDocument();
  });

  it("switches to the scheduled tab with the create form via /schedule", async () => {
    await renderApp();

    await userEvent.type(screen.getByRole("textbox"), "/schedule{Enter}");

    expect(screen.getByRole("tab", { name: "Scheduled" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("Task name")).toBeInTheDocument();
  });

  it("sends session.compact for /compact", async () => {
    const socket = await renderApp();

    await userEvent.type(screen.getByRole("textbox"), "/compact{Enter}");

    expect(socket.sent).toContainEqual({
      method: "session.compact",
      params: { session_id: null },
    });
  });
});
