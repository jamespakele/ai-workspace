import { Settings } from "lucide-react";

const statusClassName = {
  connecting: "bg-gray-400",
  connected: "bg-green-400",
  reconnecting: "bg-yellow-400 animate-pulse",
  disconnected: "bg-red-500",
};

export function StatusBar({
  gatewayStatus,
  activeModel,
  tokenCount,
  onSettingsOpen,
}) {
  return (
    <footer className="flex h-statusbar items-center justify-between border-t border-border bg-sidebar px-4 font-mono text-xs text-muted">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${statusClassName[gatewayStatus] ?? statusClassName.disconnected}`}
          />
          gateway {gatewayStatus}
        </span>
        <span>model: {activeModel ?? "—"}</span>
      </div>
      <div className="flex items-center gap-3">
        <span>project: none</span>
        <span>session: scaffold</span>
        <span>tokens: {tokenCount.toLocaleString()}</span>
        <button
          type="button"
          onClick={onSettingsOpen}
          className="inline-flex items-center justify-center rounded-md p-1 text-muted transition hover:bg-muted hover:text-text"
          aria-label="Open settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </footer>
  );
}
