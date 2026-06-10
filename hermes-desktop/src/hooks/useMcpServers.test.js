import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { mockCommand, resetInvokeMocks } from "../test/tauri-mock";

vi.mock("@tauri-apps/api/core", () => import("../test/tauri-mock"));

import { useMcpServers } from "./useMcpServers";

function storeBackedCommands(initial = []) {
  let stored = initial;
  mockCommand("list_mcp_servers", () => stored);
  mockCommand("save_mcp_servers", ({ servers }) => {
    stored = servers;
  });
  return () => stored;
}

const slack = {
  name: "slack",
  transport: "stdio",
  command: "npx slack-mcp",
  url: "",
  enabled: true,
};

describe("useMcpServers", () => {
  beforeEach(() => {
    resetInvokeMocks();
  });

  it("loads servers from the backend", async () => {
    storeBackedCommands([slack]);
    const { result } = renderHook(() => useMcpServers());

    await waitFor(() => expect(result.current.servers).toHaveLength(1));
    expect(result.current.servers[0].name).toBe("slack");
  });

  it("adds and persists a server", async () => {
    const getStored = storeBackedCommands();
    const { result } = renderHook(() => useMcpServers());

    await act(() => result.current.addServer(slack));

    expect(getStored()).toHaveLength(1);
    expect(result.current.servers).toHaveLength(1);
  });

  it("removes and toggles servers", async () => {
    const getStored = storeBackedCommands([slack]);
    const { result } = renderHook(() => useMcpServers());
    await waitFor(() => expect(result.current.servers).toHaveLength(1));

    await act(() => result.current.toggleServer("slack"));
    expect(getStored()[0].enabled).toBe(false);

    await act(() => result.current.removeServer("slack"));
    expect(getStored()).toHaveLength(0);
  });

  it("surfaces backend validation errors without mutating state", async () => {
    storeBackedCommands([slack]);
    const { result } = renderHook(() => useMcpServers());
    await waitFor(() => expect(result.current.servers).toHaveLength(1));

    mockCommand("save_mcp_servers", () => {
      throw new Error('connector "slack" already exists');
    });

    let added;
    await act(async () => {
      added = await result.current.addServer({ ...slack });
    });

    expect(added).toBe(false);
    expect(result.current.error).toMatch(/already exists/);
    expect(result.current.servers).toHaveLength(1);
  });
});
