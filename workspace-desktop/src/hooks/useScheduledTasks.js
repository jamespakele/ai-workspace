import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@/lib/api";

import { isDue } from "@/lib/cadence";

export const DUE_CHECK_INTERVAL_MS = 30_000;

// Scheduled tasks: persisted by the Rust backend, executed by submitting the
// task prompt to the gateway when its cadence comes due.
export function useScheduledTasks({ send } = {}) {
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const tasksRef = useRef(tasks);
  const sendRef = useRef(send);

  tasksRef.current = tasks;
  sendRef.current = send;

  const refresh = useCallback(async () => {
    try {
      const result = await invoke("list_scheduled_tasks");
      setTasks(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error("list_scheduled_tasks failed", error);
    } finally {
      setLoaded(true);
    }
  }, []);

  const persist = useCallback(async (nextTasks) => {
    setTasks(nextTasks);
    try {
      await invoke("save_scheduled_tasks", { tasks: nextTasks });
    } catch (error) {
      console.error("save_scheduled_tasks failed", error);
    }
  }, []);

  const addTask = useCallback(
    async ({ name, prompt, cadence }) => {
      const task = {
        id: crypto.randomUUID(),
        name,
        prompt,
        cadence,
        enabled: true,
        last_run: null,
      };
      await persist([...tasksRef.current, task]);
      return task;
    },
    [persist],
  );

  const removeTask = useCallback(
    async (id) => {
      await persist(tasksRef.current.filter((task) => task.id !== id));
    },
    [persist],
  );

  const toggleTask = useCallback(
    async (id) => {
      await persist(
        tasksRef.current.map((task) =>
          task.id === id ? { ...task, enabled: !task.enabled } : task,
        ),
      );
    },
    [persist],
  );

  const runDueTasks = useCallback(
    async (now = new Date()) => {
      const current = tasksRef.current;
      const due = current.filter((task) => isDue(task, now));
      if (due.length === 0) {
        return [];
      }

      const epoch = Math.floor(now.getTime() / 1000);
      for (const task of due) {
        sendRef.current?.("prompt.submit", {
          text: task.prompt,
          scheduled_task_id: task.id,
        });
      }

      const dueIds = new Set(due.map((task) => task.id));
      await persist(
        tasksRef.current.map((task) =>
          dueIds.has(task.id) ? { ...task, last_run: epoch } : task,
        ),
      );

      return due;
    },
    [persist],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void runDueTasks(new Date());
    }, DUE_CHECK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [runDueTasks]);

  return {
    tasks,
    loaded,
    refresh,
    addTask,
    removeTask,
    toggleTask,
    runDueTasks,
  };
}
