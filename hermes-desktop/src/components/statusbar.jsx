import { Settings } from "lucide-react";

import { computeContextUsage } from "@/lib/context-usage";

const contextLevelClassName = {
  ok: "text-muted",
  warn: "text-yellow-400",
  critical: "text-red-400",
};

const statusClassName = {
  connecting: "bg-gray-400",
  connected: "bg-green-400",
  reconnecting: "bg-yellow-400 animate-pulse",
  disconnected: "bg-red-500",
};

export function StatusBar({
  gatewayStatus,
  activeModel,
  activeSessionId,
  tokenCount,
  contextWindow,
  onSettingsOpen,
  onConnectOpen,
}) {
  const usage = computeContextUsage(tokenCount, contextWindow);

  return (
    <footer className="flex h-statusbar items-center justify-between border-t border-border bg-sidebar px-4 font-mono text-xs text-muted">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${statusClassName[gatewayStatus] ?? statusClassName.disconnected}`}
          />
          gateway {gatewayStatus}
        </span>
        <button
          type="button"
          onClick={onConnectOpen}
          aria-label="Connect to Hermes"
          className="rounded-md border border-border px-2 py-0.5 text-muted transition hover:border-accent/40 hover:text-text"
        >
          connect
        </button>
        <span>model: {activeModel ?? "—"}</span>
      </div>
      <div className="flex items-center gap-3">
        <span>project: none</span>
        <span>session: {activeSessionId ? `${activeSessionId.slice(0, 8)}…` : "—"}</span>
        <span>tokens: {tokenCount.toLocaleString()}</span>
        <span
          data-testid="context-usage"
          className={contextLevelClassName[usage.level]}
        >
          ctx {usage.percent}%
        </span>
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
