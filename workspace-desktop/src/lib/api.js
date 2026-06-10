/**
 * Backend API adapter.
 *
 * Detects the runtime environment and routes calls accordingly:
 * - In Tauri (desktop): uses invoke() IPC to the Rust backend.
 * - In browser (Docker/web): uses fetch() HTTP to the Axum server.
 *
 * All hooks and components import `invoke` from this module instead of
 * directly from `@tauri-apps/api/core`.
 */

const IS_TAURI =
  typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);

/**
 * Map Tauri command names to REST endpoints.
 */
const COMMAND_MAP = {
  // Sessions
  list_sessions:          { method: "GET",    url: "/api/sessions" },
  get_session_messages:   { method: "GET",    url: "/api/sessions/messages" },

  // Config
  get_config:             { method: "GET",    url: "/api/config" },
  save_config:            { method: "POST",   url: "/api/config" },

  // Projects
  list_projects:          { method: "GET",    url: "/api/projects" },
  add_project:            { method: "POST",   url: "/api/projects" },

  // Filesystem
  read_dir:               { method: "POST",   url: "/api/fs/read_dir" },
  read_file:              { method: "POST",   url: "/api/fs/read_file" },

  // Skills (legacy)
  import_skill:           { method: "POST",   url: "/api/skills/import" },
  list_skills:            { method: "GET",    url: "/api/skills" },

  // Scheduled tasks
  list_scheduled_tasks:   { method: "GET",    url: "/api/scheduled" },
  save_scheduled_tasks:   { method: "POST",   url: "/api/scheduled" },

  // MCP servers
  list_mcp_servers:       { method: "GET",    url: "/api/mcp" },
  save_mcp_servers:       { method: "POST",   url: "/api/mcp" },

  // Discovery
  discover_hermes:        { method: "GET",    url: "/api/discover_hermes" },
  discover_agents:        { method: "GET",    url: "/api/discover_agents" },

  // Harness
  send_prompt:            { method: "POST",   url: "/api/send_prompt" },

  // Workspace
  load_workspace:         { method: "POST",   url: "/api/workspace" },
  init_workspace:         { method: "POST",   url: "/api/workspace/init" },
  scope_skill_to_project: { method: "POST",   url: "/api/workspace/skills/scope" },
  unscope_skill_from_project: { method: "DELETE", url: "/api/workspace/skills/scope" },
  list_global_skills:     { method: "GET",    url: "/api/workspace/skills/global" },
  list_project_skills:    { method: "POST",   url: "/api/workspace/skills/project" },
  install_skill_package:  { method: "POST",   url: "/api/workspace/skills/install" },
};

/**
 * Unified invoke() function.
 *
 * Usage is identical to Tauri's invoke:
 *   const result = await invoke("send_prompt", { text: "hello", agent: "hermes" });
 */
export async function invoke(command, args = {}) {
  if (IS_TAURI) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke(command, args);
  }

  // Web mode: map to REST endpoint
  const mapping = COMMAND_MAP[command];
  if (!mapping) {
    throw new Error(`Unknown command: ${command}`);
  }

  const { method, url } = mapping;
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
  };

  if (method !== "GET") {
    options.body = JSON.stringify(args);
  } else if (Object.keys(args).length > 0) {
    // For GET requests, append args as query params
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined && value !== null) {
        params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
      }
    }
    const separator = url.includes("?") ? "&" : "?";
    options.url = `${url}${separator}${params.toString()}`;
  }

  const response = await fetch(options.url || url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  // Handle empty responses (204 No Content)
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
