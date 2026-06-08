import { useState } from "react";

function truncate(value, length) {
  if (!value) {
    return "";
  }

  return value.length > length ? `${value.slice(0, length)}…` : value;
}

function formatDate(epochSeconds) {
  const date = new Date(epochSeconds * 1000);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);

  if (diffDays === 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getSessionLabel(session, length) {
  const primary = session.title?.trim() || session.preview?.trim() || "Untitled";
  return truncate(primary, length);
}

export function SessionSwitcher({
  sessions,
  activeSessionId,
  setActiveSessionId,
  send,
  resetTokenCount,
}) {
  const [open, setOpen] = useState(false);
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;
  const triggerLabel = activeSession ? getSessionLabel(activeSession, 63) : "New Session";

  const handleNewSession = () => {
    send("session.create", {});
    setActiveSessionId(null);
    resetTokenCount();
    setOpen(false);
  };

  const handleResumeSession = (sessionId) => {
    send("session.resume", { session_id: sessionId });
    setActiveSessionId(sessionId);
    resetTokenCount();
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-panel/80 px-4 py-3 text-left transition hover:border-accent/40 hover:bg-panel"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
            Hermes Desktop
          </p>
          <p className="mt-1 truncate text-base font-semibold text-text">{triggerLabel}</p>
        </div>
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          {open ? "Close" : "Switch"}
        </span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-10 mt-2 w-[30rem] max-w-[calc(100vw-4rem)] overflow-hidden rounded-2xl border border-border bg-sidebar shadow-2xl">
          <button
            type="button"
            onClick={handleNewSession}
            className="flex w-full items-center justify-between border-b border-border px-4 py-3 text-left text-sm text-text transition hover:bg-panel/80"
          >
            <span className="font-medium">+ New Session</span>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              Fresh
            </span>
          </button>
          <div className="max-h-80 overflow-y-auto">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => handleResumeSession(session.id)}
                className={`flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-panel/70 ${
                  session.id === activeSessionId ? "bg-panel/80" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">
                    {getSessionLabel(session, 50)}
                  </p>
                  <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-muted">
                    {formatDate(session.started_at)}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-muted">
                  {Number(session.total_tokens ?? 0).toLocaleString()}
                </span>
              </button>
            ))}
            {sessions.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted">No recent Hermes sessions found.</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
