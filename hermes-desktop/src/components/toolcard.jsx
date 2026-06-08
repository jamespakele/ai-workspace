export function ToolCard({ toolName, status, summary }) {
  return (
    <section className="max-w-3xl rounded-2xl border border-border bg-sidebar/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
          Tool call
        </p>
        <span className="rounded-full border border-accent/40 px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-accent">
          {status}
        </span>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-text">{toolName}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{summary}</p>
    </section>
  );
}
