export function Sidebar() {
  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="border-b border-border px-5 py-4">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
          Sidebar
        </p>
        <h2 className="mt-2 text-lg font-semibold text-text">Workspace</h2>
        <p className="mt-1 text-sm text-muted">
          Project switcher, file tree, and sessions will land in follow-up stories.
        </p>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
        <section className="rounded-2xl border border-border bg-panel/60 p-4">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
            Projects
          </p>
          <div className="mt-3 rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted">
            No active project loaded.
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-panel/60 p-4">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
            Sessions
          </p>
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-border px-3 py-3 text-sm text-text">
              Scaffold session
            </div>
            <div className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted">
              Session history stub
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}
