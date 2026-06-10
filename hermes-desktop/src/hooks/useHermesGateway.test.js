import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { mockCommand, resetInvokeMocks } from "../test/tauri-mock";

vi.mock("@tauri-apps/api/core", () => import("../test/tauri-mock"));

import { useHermesGateway } from "./useHermesGateway";

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

describe("useHermesGateway", () => {
  beforeEach(() => {
    resetInvokeMocks();
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    mockCommand("get_config", {
      gateway_url: "ws://localhost:8765",
      auto_start_gateway: false,
    });
  });

  async function connectedHook(options) {
    const hook = renderHook(() => useHermesGateway(options));
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0];
    act(() => socket.open());
    await waitFor(() => expect(hook.result.current.status).toBe("connected"));
    return { hook, socket };
  }

  it("connects and reports connected status", async () => {
    const { socket } = await connectedHook();
    expect(socket.url).toBe("ws://localhost:8765");
  });

  it("routes permission.request events to onChatEvent", async () => {
    const onChatEvent = vi.fn();
    const { socket } = await connectedHook({ onChatEvent });

    act(() =>
      socket.receive({
        event: "permission.request",
        data: { request_id: "r1", tool_name: "bash", args: {} },
      }),
    );

    expect(onChatEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "permission.request" }),
    );
  });

  it("routes plan.update events to onChatEvent", async () => {
    const onChatEvent = vi.fn();
    const { socket } = await connectedHook({ onChatEvent });

    act(() =>
      socket.receive({
        event: "plan.update",
        data: { steps: [{ id: "1", title: "step", status: "pending" }] },
      }),
    );

    expect(onChatEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "plan.update" }),
    );
  });

  it("accumulates token counts from message.complete", async () => {
    const { hook, socket } = await connectedHook();

    act(() =>
      socket.receive({
        event: "message.complete",
        data: { input_tokens: 1200, output_tokens: 300 },
      }),
    );

    await waitFor(() => expect(hook.result.current.tokenCount).toBe(1500));
  });

  it("reconnect re-reads config and opens a socket to the new gateway", async () => {
    const { hook } = await connectedHook();

    mockCommand("get_config", {
      gateway_url: "ws://localhost:32768",
      auto_start_gateway: false,
    });

    act(() => {
      hook.result.current.reconnect();
    });

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    const newSocket = FakeWebSocket.instances[1];
    expect(newSocket.url).toBe("ws://localhost:32768");

    act(() => newSocket.open());
    await waitFor(() => expect(hook.result.current.status).toBe("connected"));
  });

  it("send writes JSON-RPC frames to the socket", async () => {
    const { hook, socket } = await connectedHook();

    act(() => {
      hook.result.current.send("prompt.cancel", { session_id: "s1" });
    });

    expect(socket.sent).toEqual([
      { method: "prompt.cancel", params: { session_id: "s1" } },
    ]);
  });
});
