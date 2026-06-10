import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * Hook to discover installed agent CLIs on the system.
 * Returns a list of available agents with name, binary path, and version.
 */
export function useAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const discover = async () => {
      try {
        const result = await invoke("discover_agents");

        if (active) {
          setAgents(result);
        }
      } catch (error) {
        console.error("Agent discovery failed:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void discover();

    return () => {
      active = false;
    };
  }, []);

  return { agents, loading };
}
