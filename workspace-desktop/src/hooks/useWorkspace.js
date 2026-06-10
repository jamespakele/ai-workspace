import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * Hook to load workspace context (soul.md, os.md, skills) from the backend.
 * Re-fetches when the active project changes.
 */
export function useWorkspace(projectDir) {
  const [workspace, setWorkspace] = useState({
    soul: "",
    os: "",
    available_skills: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await invoke("load_workspace", {
        projectDir: projectDir || null,
      });
      setWorkspace(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [projectDir]);

  useEffect(() => {
    void load();
  }, [load]);

  const initWorkspace = useCallback(async () => {
    try {
      const root = await invoke("init_workspace");
      await load();
      return root;
    } catch (err) {
      setError(String(err));
      return null;
    }
  }, [load]);

  const scopeSkill = useCallback(
    async (skillName) => {
      if (!projectDir) {
        return;
      }

      try {
        await invoke("scope_skill_to_project", {
          skillName,
          projectDir,
        });
        await load();
      } catch (err) {
        setError(String(err));
      }
    },
    [projectDir, load],
  );

  return {
    soul: workspace.soul,
    os: workspace.os,
    skills: workspace.available_skills,
    loading,
    error,
    initWorkspace,
    scopeSkill,
    refresh: load,
  };
}
