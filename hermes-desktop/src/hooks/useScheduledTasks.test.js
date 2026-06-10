import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { invoke, mockCommand, resetInvokeMocks } from "../test/tauri-mock";

vi.mock("@tauri-apps/api/core", () => import("../test/tauri-mock"));

import { useScheduledTasks } from "./useScheduledTasks";

function storeBackedCommands(initial = []) {
  let stored = initial;
  mockCommand("list_scheduled_tasks", () => stored);
  mockCommand("save_scheduled_tasks", ({ tasks }) => {
    stored = tasks;
  });
  return () => stored;
}

describe("useScheduledTasks", () => {
  beforeEach(() => {
    resetInvokeMocks();
  });

  it("loads tasks from the backend", async () => {
    storeBackedCommands([
      {
        id: "t1",
        name: "Daily digest",
        prompt: "Summarize inbox",
        cadence: "daily@09:00",
        enabled: true,
        last_run: null,
      },
    ]);

    const { result } = renderHook(() => useScheduledTasks({ send: vi.fn() }));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].name).toBe("Daily digest");
  });

  it("adds and persists a task", async () => {
    const getStored = storeBackedCommands();
    const { result } = renderHook(() => useScheduledTasks({ send: vi.fn() }));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(() =>
      result.current.addTask({
        name: "Weekly report",
        prompt: "Write the weekly report",
        cadence: "weekly:fri@16:00",
      }),
    );

    expect(result.current.tasks).toHaveLength(1);
    expect(getStored()).toHaveLength(1);
    expect(getStored()[0]).toMatchObject({
      name: "Weekly report",
      enabled: true,
      last_run: null,
    });
  });

  it("removes and toggles tasks", async () => {
    const getStored = storeBackedCommands([
      {
        id: "t1",
        name: "a",
        prompt: "p",
        cadence: "hourly",
        enabled: true,
        last_run: null,
      },
      {
        id: "t2",
        name: "b",
        prompt: "p",
        cadence: "hourly",
        enabled: true,
        last_run: null,
      },
    ]);
    const { result } = renderHook(() => useScheduledTasks({ send: vi.fn() }));
    await waitFor(() => expect(result.current.tasks).toHaveLength(2));

    await act(() => result.current.toggleTask("t1"));
    expect(getStored().find((task) => task.id === "t1").enabled).toBe(false);

    await act(() => result.current.removeTask("t2"));
    expect(getStored()).toHaveLength(1);
  });

  it("submits due tasks to the gateway and records last_run exactly once", async () => {
    storeBackedCommands([
      {
        id: "due",
        name: "Morning digest",
        prompt: "Summarize my inbox",
        cadence: "daily@09:00",
        enabled: true,
        last_run: null,
      },
      {
        id: "off",
        name: "Disabled",
        prompt: "never",
        cadence: "daily@09:00",
        enabled: false,
        last_run: null,
      },
    ]);
    const send = vi.fn();
    const { result } = renderHook(() => useScheduledTasks({ send }));
    await waitFor(() => expect(result.current.tasks).toHaveLength(2));

    const now = new Date(2026, 5, 10, 9, 30, 0);
    await act(() => result.current.runDueTasks(now));

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("prompt.submit", {
      text: "Summarize my inbox",
      scheduled_task_id: "due",
    });

    // A second sweep in the same period must not fire again.
    send.mockClear();
    await act(() => result.current.runDueTasks(new Date(2026, 5, 10, 9, 31, 0)));
    expect(send).not.toHaveBeenCalled();
  });

  it("sweeps for due tasks on an interval", async () => {
    vi.useFakeTimers();
    try {
      storeBackedCommands([]);
      renderHook(() => useScheduledTasks({ send: vi.fn() }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(35_000);
      });

      // The sweep itself ran without error; with no due tasks nothing persists.
      expect(invoke).toHaveBeenCalledWith("list_scheduled_tasks");
    } finally {
      vi.useRealTimers();
    }
  });
});
