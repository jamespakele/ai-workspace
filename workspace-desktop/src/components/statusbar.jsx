import { Settings } from "lucide-react";

export function StatusBar({
  onSettingsOpen,
}) {
  return (
    <footer className="flex h-statusbar items-center justify-end border-t border-border bg-sidebar px-4 font-mono text-xs text-muted">
      <button
        type="button"
        onClick={onSettingsOpen}
        className="inline-flex items-center justify-center rounded-md p-1 text-muted transition hover:bg-muted hover:text-text"
        aria-label="Open settings"
      >
        <Settings className="h-4 w-4" />
      </button>
    </footer>
  );
}
