function basename(path) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

// Files Hermes created or modified during the current session — Cowork's
// "finished deliverables on your file system", surfaced in the sidebar.
export function OutputsPanel({ outputs, onOpen }) {
  if (outputs.length === 0) {
    return (
      <div className="px-4 py-4 text-sm text-muted">
        Files Hermes writes this session will appear here.
      </div>
    );
  }

  return (
    <ul data-testid="outputs-list" className="py-2">
      {outputs.map((path) => (
        <li key={path}>
          <button
            type="button"
            onClick={() => onOpen(path)}
            className="block w-full px-4 py-2 text-left transition hover:bg-panel/70"
            title={path}
          >
            <p className="truncate text-sm text-text">{basename(path)}</p>
            <p className="truncate font-mono text-xs text-muted">{path}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}
