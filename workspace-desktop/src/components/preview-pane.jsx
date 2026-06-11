import { useEffect, useState } from "react";
import { invoke } from "@/lib/api";

// In Tauri, convertFileSrc maps file:// paths to the asset protocol.
// In the browser, we serve images through the API instead.
const IS_TAURI = typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);

async function convertFileSrc(path) {
  if (IS_TAURI) {
    const { convertFileSrc: tauriConvert } = await import("@tauri-apps/api/core");
    return tauriConvert(path);
  }
  return `/api/fs/file?path=${encodeURIComponent(path)}`;
}

// convertFileSrc is async (Tauri's variant is loaded lazily), so the URL
// must be resolved into state rather than passed to src directly.
function useFileSrc(path, enabled) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let cancelled = false;
    setSrc(null);
    convertFileSrc(path).then((url) => {
      if (!cancelled) {
        setSrc(url);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [path, enabled]);

  return src;
}

import { Markdown } from "./markdown";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"]);
const PREVIEWABLE = new Set(["html", "htm", "md", "markdown"]);

function extensionOf(path) {
  const name = path.split(/[\\/]/).at(-1) ?? "";
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function PreviewPane({ path, onClose }) {
  const [state, setState] = useState({ status: "loading" });
  const [mode, setMode] = useState("preview"); // "source" | "preview"
  const extension = extensionOf(path);
  const isImage = IMAGE_EXTENSIONS.has(extension);
  const canPreview = PREVIEWABLE.has(extension);
  const imageSrc = useFileSrc(path, isImage);

  // Reset to preview mode when file changes
  useEffect(() => {
    if (canPreview) setMode("preview");
    else setMode("source");
  }, [path, canPreview]);

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

  const isHtml = extension === "html" || extension === "htm";
  const isMd = extension === "md" || extension === "markdown";

  return (
    <aside
      data-testid="preview-pane"
      className="flex h-full shrink-0 flex-col border-l border-border bg-sidebar"
      style={{ width: "100%" }}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="min-w-0 truncate font-mono text-xs text-muted" title={path}>
          {path}
        </p>
        <div className="flex items-center gap-2">
          {/* Source / Preview toggle for HTML and Markdown */}
          {canPreview && state.status === "ready" && state.file && !state.file.binary ? (
            <div className="flex rounded-md border border-border text-[10px]">
              <button
                type="button"
                onClick={() => setMode("source")}
                className={`px-2 py-0.5 transition ${
                  mode === "source"
                    ? "bg-accent/20 text-accent"
                    : "text-muted hover:text-text"
                }`}
              >
                Source
              </button>
              <button
                type="button"
                onClick={() => setMode("preview")}
                className={`px-2 py-0.5 transition ${
                  mode === "preview"
                    ? "bg-accent/20 text-accent"
                    : "text-muted hover:text-text"
                }`}
              >
                Preview
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-md px-2 py-1 text-sm text-muted transition hover:bg-panel/70 hover:text-text"
          >
            ✕
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {state.status === "loading" ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : null}

        {state.status === "error" ? (
          <p className="text-sm text-red-400">{state.error}</p>
        ) : null}

        {state.status === "ready" && isImage && imageSrc ? (
          <img
            src={imageSrc}
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

            {/* Preview mode: render HTML/Markdown */}
            {mode === "preview" && isHtml ? (
              <iframe
                srcDoc={state.file.content}
                title="HTML Preview"
                className="h-full w-full rounded-lg border border-border bg-white"
                style={{ minHeight: "400px" }}
                sandbox="allow-scripts"
              />
            ) : mode === "preview" && isMd ? (
              <Markdown content={state.file.content} />
            ) : (
              /* Source mode: raw code */
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
