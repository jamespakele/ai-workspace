import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";

import { Button } from "@/components/ui/button";
import { useAppConfig } from "@/hooks/useAppConfig";

const EMPTY_CONFIG = {
  hermes_bin: "",
  gateway_url: "",
  auto_start_gateway: false,
  active_project: "",
};

export function SettingsPanel({ open, onClose }) {
  const { config, saveConfig, loading, error } = useAppConfig();
  const [form, setForm] = useState(EMPTY_CONFIG);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(config ?? EMPTY_CONFIG);
      setSaveError(null);
    }
  }, [config, open]);

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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
