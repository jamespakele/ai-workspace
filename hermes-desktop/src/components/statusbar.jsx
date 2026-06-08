export function StatusBar() {
  return (
    <footer className="flex h-statusbar items-center justify-between border-t border-border bg-sidebar px-4 font-mono text-xs text-muted">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent" />
          gateway stub
        </span>
        <span>model: unset</span>
      </div>
      <div className="flex items-center gap-3">
        <span>project: none</span>
        <span>session: scaffold</span>
        <span>tokens: 0</span>
      </div>
    </footer>
  );
}
