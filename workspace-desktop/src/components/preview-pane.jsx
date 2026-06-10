import { useEffect, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";

import { Markdown } from "./markdown";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"]);

function extensionOf(path) {
  const name = path.split(/[\\/]/).at(-1) ?? "";
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function PreviewPane({ path, onClose }) {
  const [state, setState] = useState({ status: "loading" });
  const extension = extensionOf(path);
  const isImage = IMAGE_EXTENSIONS.has(extension);

  useEffect(() => {
    if (isImage) {
      setState({ status: "ready" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    invoke("read_file", { path })
      .then((file) => {
        if (!cancelled) {
          setState({ status: "ready", file });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ status: "error", error: String(error) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isImage, path]);

  return (
    <aside
      data-testid="preview-pane"
      className="flex w-[28rem] shrink-0 flex-col border-l border-border bg-sidebar"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="min-w-0 truncate font-mono text-xs text-muted" title={path}>
          {path}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="rounded-md px-2 py-1 text-sm text-muted transition hover:bg-panel/70 hover:text-text"
        >
          ✕
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {state.status === "loading" ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : null}

        {state.status === "error" ? (
          <p className="text-sm text-red-400">{state.error}</p>
        ) : null}

        {state.status === "ready" && isImage ? (
          <img
            src={convertFileSrc(path)}
            alt={path.split(/[\\/]/).at(-1)}
            className="max-w-full rounded-lg"
          />
        ) : null}

        {state.status === "ready" && !isImage && state.file?.binary ? (
          <p className="text-sm text-muted">
            Binary file — preview not available.
          </p>
        ) : null}

        {state.status === "ready" && !isImage && state.file && !state.file.binary ? (
          <>
            {state.file.truncated ? (
              <p className="mb-3 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-400">
                File truncated for preview.
              </p>
            ) : null}
            {extension === "md" || extension === "markdown" ? (
              <Markdown content={state.file.content} />
            ) : (
              <pre className="overflow-x-auto rounded-lg bg-canvas p-3 font-mono text-xs leading-5 text-text">
                {state.file.content}
              </pre>
            )}
          </>
        ) : null}
      </div>
    </aside>
  );
}
