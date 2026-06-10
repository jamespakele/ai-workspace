import { Settings } from "lucide-react";

import { computeContextUsage } from "@/lib/context-usage";

const contextLevelClassName = {
  ok: "text-muted",
  warn: "text-yellow-400",
  critical: "text-red-400",
};

export function StatusBar({
  activeAgent,
  activeProjectName,
  activeSessionId,
  tokenCount,
  contextWindow,
  onSettingsOpen,
}) {
  const usage = computeContextUsage(tokenCount, contextWindow);

  return (
    <footer className="flex h-statusbar items-center justify-between border-t border-border bg-sidebar px-4 font-mono text-xs text-muted">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-400" />
          agent: {activeAgent || "none"}
        </span>
        <span>project: {activeProjectName || "none"}</span>
      </div>
      <div className="flex items-center gap-3">
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
