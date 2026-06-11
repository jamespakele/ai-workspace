import { useEffect, useState } from "react";
import { invoke } from "@/lib/api";

const IS_TAURI = typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);

async function tauriListen(event, handler) {
  if (!IS_TAURI) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen(event, handler);
}

async function openDialog(options) {
  if (!IS_TAURI) {
    // In browser mode, use a native file input
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = (options?.filters?.[0]?.extensions || [])
        .map((e) => `.${e}`)
        .join(",");
      input.onchange = () => {
        const file = input.files?.[0];
        resolve(file ? file.name : null);
      };
      input.click();
    });
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  return open(options);
}
import { Dialog } from "radix-ui";

import { Button } from "@/components/ui/button";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useMcpServers } from "@/hooks/useMcpServers";

const EMPTY_CONNECTOR_FORM = {
  name: "",
  transport: "stdio",
  command: "",
  url: "",
};

function ConnectorsSection() {
  const { servers, error, addServer, removeServer, toggleServer } =
    useMcpServers();
  const [form, setForm] = useState(EMPTY_CONNECTOR_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleAdd = async () => {
    const added = await addServer({
      name: form.name.trim(),
      transport: form.transport,
      command: form.command.trim(),
      url: form.url.trim(),
      enabled: true,
    });

    if (added) {
      setForm(EMPTY_CONNECTOR_FORM);
      setFormOpen(false);
      setSaved(true);
    }
  };

  const mutate = async (action) => {
    const changed = await action();
    if (changed) {
      setSaved(true);
    }
  };

  return (
    <section className="mt-6 border-t border-border pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text">Connectors</h3>
          <p className="mt-1 text-sm text-muted">
            MCP servers Hermes can reach (stored in ~/.hermes/mcp.json).
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setFormOpen((current) => !current)}
        >
          {formOpen ? "Cancel" : "Add connector"}
        </Button>
      </div>

      {formOpen ? (
        <div className="mt-4 space-y-2 rounded-2xl border border-border bg-canvas p-4">
          <input
            type="text"
            placeholder="Name (e.g. slack)"
            aria-label="Connector name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            className="w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
          <select
            aria-label="Connector transport"
            value={form.transport}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                transport: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text outline-none focus:border-accent"
          >
            <option value="stdio">stdio</option>
            <option value="http">http</option>
          </select>
          {form.transport === "stdio" ? (
            <input
              type="text"
              placeholder="Command (e.g. npx slack-mcp)"
              aria-label="Connector command"
              value={form.command}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  command: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
          ) : (
            <input
              type="text"
              placeholder="URL (https://…)"
              aria-label="Connector URL"
              value={form.url}
              onChange={(event) =>
                setForm((current) => ({ ...current, url: event.target.value }))
              }
              className="w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
          )}
          <Button type="button" className="w-full" onClick={() => void handleAdd()}>
            Save connector
          </Button>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

      <ul className="mt-4 space-y-2">
        {servers.map((server) => (
          <li
            key={server.name}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-canvas px-3 py-2"
          >
            <div className="min-w-0">
              <p
                className={`truncate text-sm font-medium ${server.enabled ? "text-text" : "text-muted line-through"}`}
              >
                {server.name}
              </p>
              <p className="truncate font-mono text-xs text-muted">
                {server.transport === "http" ? server.url : server.command}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => void mutate(() => toggleServer(server.name))}
                aria-label={`${server.enabled ? "Disable" : "Enable"} ${server.name}`}
                className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-panel hover:text-text"
              >
                {server.enabled ? "On" : "Off"}
              </button>
              <button
                type="button"
                onClick={() => void mutate(() => removeServer(server.name))}
                aria-label={`Remove ${server.name}`}
                className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
        {servers.length === 0 ? (
          <li className="text-sm text-muted">No connectors configured.</li>
        ) : null}
      </ul>

      {saved ? (
        <div className="mt-3 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-[13px] text-yellow-400">
          ⚠ Restart gateway to apply connector changes
        </div>
      ) : null}
    </section>
  );
}

const EMPTY_CONFIG = {
  hermes_bin: "",
  gateway_url: "",
  auto_start_gateway: false,
  active_project: "",
};

const EMPTY_IMPORT_STATE = {
  status: "idle",
  name: "",
  triggerPhrases: [],
  error: "",
};

export function SettingsPanel({ open, onClose }) {
  const { config, saveConfig, loading, error } = useAppConfig();
  const [form, setForm] = useState(EMPTY_CONFIG);
  const [saveError, setSaveError] = useState(null);
  const [importState, setImportState] = useState(EMPTY_IMPORT_STATE);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(config ?? EMPTY_CONFIG);
      setSaveError(null);
      setIsDragging(false);
    }
  }, [config, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let cancelled = false;
    let cleanup = [];

    Promise.all([
      tauriListen("tauri://drag-drop", (event) => {
        setIsDragging(false);
        const packagePath = event.payload.paths?.find((path) => {
          const lower = path.toLowerCase();
          return lower.endsWith(".skill") || lower.endsWith(".plugin");
        });

        if (packagePath) {
          void doImport(packagePath);
        }
      }),
      tauriListen("tauri://drag-enter", () => {
        setIsDragging(true);
      }),
      tauriListen("tauri://drag-leave", () => {
        setIsDragging(false);
      }),
    ])
      .then((unlisten) => {
        if (cancelled) {
          unlisten.forEach((dispose) => dispose());
          return;
        }

        cleanup = unlisten;
      })
      .catch((eventError) => {
        console.error("skill drag-drop listeners failed:", eventError);
      });

    return () => {
      cancelled = true;
      cleanup.forEach((dispose) => dispose());
      setIsDragging(false);
    };
  }, [open]);

  const CHECKBOX_FIELDS = new Set([
    "auto_start_gateway",
    "acp_enabled",
    "acp_auto_approve",
  ]);

  const handleChange = (field) => (event) => {
    const value = CHECKBOX_FIELDS.has(field)
      ? event.target.checked
      : event.target.value;

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    setSaveError(null);

    try {
      await saveConfig(form);
      onClose();
    } catch (saveFailure) {
      setSaveError(String(saveFailure));
    }
  };

  const doImport = async (path) => {
    setImportState({
      status: "loading",
      name: "",
      triggerPhrases: [],
      error: "",
    });

    try {
      const result = await invoke("install_skill_package", { filePath: path });
      setImportState({
        status: "success",
        name: result,
        triggerPhrases: [],
        error: "",
      });
    } catch (importError) {
      setImportState({
        status: "error",
        name: "",
        triggerPhrases: [],
        error: String(importError),
      });
    }
  };

  const handleBrowse = async () => {
    try {
      const selection = await openDialog({
        multiple: false,
        filters: [
          { name: "Skill & Plugin Files", extensions: ["skill", "plugin"] },
        ],
      });
      const path = typeof selection === "string" ? selection : null;

      if (!path) {
        return;
      }

      await doImport(path);
    } catch (dialogError) {
      setImportState({
        status: "error",
        name: "",
        triggerPhrases: [],
        error: String(dialogError),
      });
    }
  };

  const disabled = loading || config === null;
  const visibleError = saveError ?? error;

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[calc(100vh-4rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-panel p-6 shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-text">
                Workspace Settings
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Configure workspace, skills, plugins, and agent defaults.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm text-muted transition hover:bg-muted hover:text-text"
                aria-label="Close settings"
              >
                Esc
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-text">
                Hermes binary path
              </span>
              <input
                type="text"
                placeholder="/home/user/.local/bin/hermes"
                value={form.hermes_bin ?? ""}
                onChange={handleChange("hermes_bin")}
                className="w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm text-text outline-none transition focus:border-accent"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-text">
                Gateway URL
              </span>
              <input
                type="text"
                placeholder="ws://localhost:8765"
                value={form.gateway_url ?? ""}
                onChange={handleChange("gateway_url")}
                className="w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm text-text outline-none transition focus:border-accent"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-text">
                Active project path
              </span>
              <input
                type="text"
                placeholder="/home/user/code/project"
                value={form.active_project ?? ""}
                onChange={handleChange("active_project")}
                className="w-full rounded-xl border border-border bg-canvas px-3 py-2 text-sm text-text outline-none transition focus:border-accent"
              />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-canvas px-3 py-3">
              <span>
                <span className="block text-sm font-medium text-text">
                  Auto-start gateway on launch
                </span>
                <span className="mt-1 block text-xs text-muted">
                  Start Hermes automatically when the desktop app opens.
                </span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(form.auto_start_gateway)}
                onChange={handleChange("auto_start_gateway")}
                className="h-4 w-4 rounded border-border bg-canvas text-accent"
              />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-canvas px-3 py-3">
              <span>
                <span className="block text-sm font-medium text-text">
                  Use Agent Client Protocol (ACP)
                </span>
                <span className="mt-1 block text-xs text-muted">
                  Drive ACP-capable agents (claude, gemini, codex, goose) over
                  the standardized protocol; others fall back automatically.
                </span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(form.acp_enabled)}
                onChange={handleChange("acp_enabled")}
                className="h-4 w-4 rounded border-border bg-canvas text-accent"
              />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-canvas px-3 py-3">
              <span>
                <span className="block text-sm font-medium text-text">
                  Auto-approve ACP permission requests
                </span>
                <span className="mt-1 block text-xs text-muted">
                  When off, agents' tool permission requests are rejected —
                  the safe default for unattended prompts.
                </span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(form.acp_auto_approve)}
                onChange={handleChange("acp_auto_approve")}
                className="h-4 w-4 rounded border-border bg-canvas text-accent"
              />
            </label>
          </div>

          {visibleError ? (
            <p className="mt-4 text-sm text-red-400">{visibleError}</p>
          ) : null}

          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={disabled}>
              Save
            </Button>
          </div>

          <section className="mt-6 border-t border-border pt-6">
            <div>
              <h3 className="text-base font-semibold text-text">Skills</h3>
              <p className="mt-1 text-sm text-muted">
                Install `.skill` or `.plugin` archives from disk or by dragging them onto the app window.
              </p>
            </div>

            <div
              className={`mt-4 rounded-2xl border border-dashed px-4 py-5 transition ${
                isDragging
                  ? "border-accent bg-accent/5"
                  : "border-border bg-canvas"
              }`}
            >
              <p className="text-sm text-text">Drop a `.skill` or `.plugin` file anywhere in the window.</p>
              <p className="mt-1 text-xs text-muted">
                Packages are extracted to `~/.workspace/skills/` or `~/.workspace/plugins/`.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => void handleBrowse()}
              >
                Browse .skill / .plugin file
              </Button>
            </div>

            {importState.status === "loading" ? (
              <p className="mt-4 text-sm text-muted">Importing skill…</p>
            ) : null}

            {importState.status === "success" ? (
              <div className="mt-4 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3">
                <p className="font-mono text-sm text-green-400">✓ {importState.name}</p>
              </div>
            ) : null}

            {importState.status === "error" ? (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {importState.error}
              </div>
            ) : null}
          </section>

          <ConnectorsSection />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
