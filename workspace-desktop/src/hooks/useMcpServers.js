import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@/lib/api";

// Connector (MCP server) management backed by ~/.hermes/mcp.json.
export function useMcpServers() {
  const [servers, setServers] = useState([]);
  const [error, setError] = useState(null);
  const serversRef = useRef(servers);

  serversRef.current = servers;

  const refresh = useCallback(async () => {
    try {
      const result = await invoke("list_mcp_servers");
      setServers(Array.isArray(result) ? result : []);
      setError(null);
    } catch (loadError) {
      setError(String(loadError));
    }
  }, []);

  const persist = useCallback(async (nextServers) => {
    try {
      await invoke("save_mcp_servers", { servers: nextServers });
      setServers(nextServers);
      setError(null);
      return true;
    } catch (saveError) {
      setError(String(saveError));
      return false;
    }
  }, []);

  const addServer = useCallback(
    (server) =>
      persist([...serversRef.current, { enabled: true, ...server }]),
    [persist],
  );

  const removeServer = useCallback(
    (name) =>
      persist(serversRef.current.filter((server) => server.name !== name)),
    [persist],
  );

  const toggleServer = useCallback(
    (name) =>
      persist(
        serversRef.current.map((server) =>
          server.name === name
            ? { ...server, enabled: !server.enabled }
            : server,
        ),
      ),
    [persist],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { servers, error, refresh, addServer, removeServer, toggleServer };
}
