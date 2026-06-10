import { useCallback, useEffect, useState } from "react";
import { invoke } from "@/lib/api";
import { Dialog } from "radix-ui";

/**
 * Server-side folder browser dialog.
 * Works in both Tauri (desktop) and browser (Docker/web) modes.
 * Uses browse_roots + read_dir_browsable to navigate the server filesystem.
 */
export function FolderBrowser({ open, onClose, onSelect }) {
  const [currentPath, setCurrentPath] = useState(null);
  const [entries, setEntries] = useState([]);
  const [roots, setRoots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  // Load roots on open
  useEffect(() => {
    if (!open) {
      return;
    }

    setCurrentPath(null);
    setHistory([]);

    invoke("browse_roots")
      .then((result) => {
        setRoots(result);
        setEntries(result);
      })
      .catch((err) => console.error("browse_roots failed:", err));
  }, [open]);

  const navigateTo = useCallback(
    async (path) => {
      setLoading(true);
      try {
        const result = await invoke("read_dir_browsable", { path });
        if (currentPath !== null) {
          setHistory((prev) => [...prev, currentPath]);
        }
        setCurrentPath(path);
        setEntries(result);
      } catch (err) {
        console.error("read_dir_browsable failed:", err);
      } finally {
        setLoading(false);
      }
    },
    [currentPath],
  );

  const goBack = useCallback(() => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setLoading(true);

      invoke("read_dir_browsable", { path: prev })
        .then((result) => {
          setCurrentPath(prev);
          setEntries(result);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      // Go back to roots
      setCurrentPath(null);
      setEntries(roots);
    }
  }, [history, roots]);

  const goUp = useCallback(() => {
    if (!currentPath) {
      return;
    }

    const parent = currentPath.replace(/\/[^/]+\/?$/, "") || "/";
    if (parent === currentPath) {
      return;
    }

    setLoading(true);
    invoke("read_dir_browsable", { path: parent })
      .then((result) => {
        setHistory((h) => [...h, currentPath]);
        setCurrentPath(parent);
        setEntries(result);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentPath]);

  const handleSelect = () => {
    if (currentPath) {
      onSelect(currentPath);
      onClose();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[520px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-panel shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-text">
              Select Project Folder
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm text-muted transition hover:bg-panel/70 hover:text-text"
              >
                ✕
              </button>
            </Dialog.Close>
          </div>

          {/* Breadcrumb / path bar */}
          <div className="flex items-center gap-2 border-b border-border bg-canvas/50 px-5 py-2.5">
            <button
              type="button"
              onClick={goBack}
              disabled={!currentPath && history.length === 0}
              className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-panel/70 hover:text-text disabled:opacity-30"
              title="Back"
            >
              ←
            </button>
            <button
              type="button"
              onClick={goUp}
              disabled={!currentPath}
              className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-panel/70 hover:text-text disabled:opacity-30"
              title="Up one level"
            >
              ↑
            </button>
            <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted">
              {currentPath || "Select a root"}
            </p>
          </div>

          {/* Directory listing */}
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {loading ? (
              <p className="px-3 py-6 text-center text-sm text-muted">
                Loading…
              </p>
            ) : entries.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted">
                Empty directory
              </p>
            ) : (
              entries.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  onClick={() => navigateTo(entry.path)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent/10"
                >
                  <span className="text-base text-accent/70">📁</span>
                  <span className="min-w-0 flex-1 truncate text-text">
                    {entry.name}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Footer with select button */}
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <p className="truncate font-mono text-xs text-muted">
              {currentPath
                ? `Will open: ${currentPath}`
                : "Navigate to a project folder"}
            </p>
            <button
              type="button"
              onClick={handleSelect}
              disabled={!currentPath}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/80 disabled:opacity-30"
            >
              Select Folder
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
