// Approval prompt for a gateway `permission.request` event. Mirrors Cowork's
// "Ask before acting" flow: the user allows once, allows the tool for the
// rest of the session, or denies.
export function ApprovalCard({ request, onRespond }) {
  return (
    <section
      data-testid="approval-card"
      className="my-2 max-w-3xl rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-4 py-3"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-yellow-400">
        Permission required
      </p>
      <p className="mt-2 text-sm text-text">
        Hermes wants to run{" "}
        <span className="font-mono font-semibold">{request.tool_name}</span>
      </p>
      {request.description ? (
        <p className="mt-1 text-sm text-muted">{request.description}</p>
      ) : null}
      <pre className="mt-2 overflow-x-auto rounded-lg bg-canvas p-3 font-mono text-[11px] text-muted">
        {JSON.stringify(request.args ?? {}, null, 2)}
      </pre>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onRespond(request, "allow_once")}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white transition hover:bg-accent/90"
        >
          Allow once
        </button>
        <button
          type="button"
          onClick={() => onRespond(request, "allow_session")}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-text transition hover:bg-panel/70"
        >
          Allow for session
        </button>
        <button
          type="button"
          onClick={() => onRespond(request, "deny")}
          className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-500/10"
        >
          Deny
        </button>
      </div>
    </section>
  );
}
