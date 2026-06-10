import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Dialog } from "radix-ui";

import { Button } from "@/components/ui/button";

const KIND_BADGE = {
  binary: "Local install",
  docker: "Docker",
  running: "Running",
};

// One-click connect: scans the usual install locations and running Docker
// containers for Hermes, probes for live gateways, and lets the user pick
// which instance to connect to when several are found.
export function ConnectWizard({ open, onClose, onConnect }) {
  const [state, setState] = useState({ status: "scanning", instances: [] });
  const [selectedId, setSelectedId] = useState(null);

  const scan = async () => {
    setState({ status: "scanning", instances: [] });
    setSelectedId(null);

    try {
      const result = await invoke("discover_hermes");
      const instances = Array.isArray(result) ? result : [];
      setState({ status: "done", instances });

      // Preselect the obvious choice: a reachable instance, else the first.
      const preferred =
        instances.find((instance) => instance.reachable) ?? instances[0];
      setSelectedId(preferred?.id ?? null);
    } catch (error) {
      setState({ status: "error", instances: [], error: String(error) });
    }
  };

  useEffect(() => {
    if (open) {
      void scan();
    }
  }, [open]);

  const selected = state.instances.find(
    (instance) => instance.id === selectedId,
  );

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[calc(100vh-4rem)] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-panel p-6 shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-text">
                Connect to Hermes
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Scans your PATH, common install folders, and running Docker
                containers.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm text-muted transition hover:bg-muted hover:text-text"
                aria-label="Close connect wizard"
              >
                Esc
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-5">
            {state.status === "scanning" ? (
              <p className="text-sm text-muted">Scanning for Hermes instances…</p>
            ) : null}

            {state.status === "error" ? (
              <p className="text-sm text-red-400">{state.error}</p>
            ) : null}

            {state.status === "done" && state.instances.length === 0 ? (
              <div className="rounded-xl border border-border bg-canvas px-4 py-4 text-sm text-muted">
                No Hermes installs or running gateways found. Install the
                Hermes Agent, start a container, or set the binary path
                manually in Settings.
              </div>
            ) : null}

            {state.instances.length > 0 ? (
              <div
                role="radiogroup"
                aria-label="Discovered Hermes instances"
                className="space-y-2"
              >
                {state.instances.map((instance) => (
                  <button
                    key={instance.id}
                    type="button"
                    role="radio"
                    aria-checked={instance.id === selectedId}
                    onClick={() => setSelectedId(instance.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      instance.id === selectedId
                        ? "border-accent bg-accent/10"
                        : "border-border bg-canvas hover:border-accent/40"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text">
                        {instance.label}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-xs text-muted">
                        {instance.gateway_url}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                        {KIND_BADGE[instance.kind] ?? instance.kind}
                      </span>
                      <span
                        aria-label={instance.reachable ? "Gateway reachable" : "Gateway not running"}
                        className={`h-2 w-2 rounded-full ${
                          instance.reachable ? "bg-green-400" : "bg-gray-500"
                        }`}
                      />
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void scan()}
              disabled={state.status === "scanning"}
            >
              Rescan
            </Button>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!selected}
                onClick={() => selected && onConnect(selected)}
              >
                Connect
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
