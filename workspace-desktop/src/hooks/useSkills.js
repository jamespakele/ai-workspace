import { useCallback, useEffect, useState } from "react";
import { invoke } from "@/lib/api";

// Imported skills from ~/.hermes/skills, surfaced in the slash-command menu.
export function useSkills() {
  const [skills, setSkills] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const result = await invoke("list_skills");
      setSkills(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error("list_skills failed", error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { skills, refresh };
}
