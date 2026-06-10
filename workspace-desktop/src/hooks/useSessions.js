import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useSessions() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const result = await invoke("list_sessions");
      setSessions(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error("list_sessions failed", error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    refresh,
  };
}
