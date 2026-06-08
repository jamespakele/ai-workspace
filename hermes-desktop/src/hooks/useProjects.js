import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useProjects() {
  const [projects, setProjects] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const nextProjects = await invoke("list_projects");
      setProjects(Array.isArray(nextProjects) ? nextProjects : []);
    } catch (error) {
      console.error("list_projects failed:", error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addProject = useCallback(
    async (path) => {
      try {
        await invoke("add_project", { path });
        await refresh();
      } catch (error) {
        console.error("add_project failed:", error);
      }
    },
    [refresh]
  );

  return { projects, addProject, refresh };
}
