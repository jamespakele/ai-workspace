import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Dialog } from "radix-ui";

import { Button } from "@/components/ui/button";
import { useAppConfig } from "@/hooks/useAppConfig";

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
      listen("tauri://drag-drop", (event) => {
        setIsDragging(false);
        const skillPath = event.payload.paths?.find((path) =>
          path.toLowerCase().endsWith(".skill"),
        );

        if (skillPath) {
          void doImport(skillPath);
        }
      }),
      listen("tauri://drag-enter", () => {
        setIsDragging(true);
      }),
      listen("tauri://drag-leave", () => {
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

  const handleChange = (field) => (event) => {
    const value =
      field === "auto_start_gateway" ? event.target.checked : event.target.value;

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
      const result = await invoke("import_skill", { path });
      setImportState({
        status: "success",
        name: result.name,
        triggerPhrases: result.trigger_phrases ?? [],
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
        filters: [{ name: "Skill Files", extensions: ["skill"] }],
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
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-panel p-6 shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-text">
                Settings
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Configure the Hermes gateway path, connection, and startup defaults.
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
                Install `.skill` archives from disk or by dragging them onto the app window.
              </p>
            </div>

            <div
              className={`mt-4 rounded-2xl border border-dashed px-4 py-5 transition ${
                isDragging
                  ? "border-accent bg-accent/5"
                  : "border-border bg-canvas"
              }`}
            >
              <p className="text-sm text-text">Drop a `.skill` file anywhere in the window.</p>
              <p className="mt-1 text-xs text-muted">
                Hermes Desktop will extract the skill into `~/.hermes/skills`.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => void handleBrowse()}
              >
                Browse .skill file
              </Button>
            </div>

            {importState.status === "loading" ? (
              <p className="mt-4 text-sm text-muted">Importing skill…</p>
            ) : null}

            {importState.status === "success" ? (
              <div className="mt-4 rounded-2xl border border-border bg-panel/70 p-4">
                <p className="font-mono font-semibold text-accent">{importState.name}</p>
                {importState.triggerPhrases.length > 0 ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5">
                    {importState.triggerPhrases.map((phrase) => (
                      <li key={phrase} className="font-mono text-sm text-text">
                        {phrase}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted">(none found)</p>
                )}
                <div className="mt-2 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-[13px] text-yellow-400">
                  ⚠ Restart gateway to activate skill
                </div>
              </div>
            ) : null}

            {importState.status === "error" ? (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {importState.error}
              </div>
            ) : null}
          </section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
