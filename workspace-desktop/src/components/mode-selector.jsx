const MODES = [
  { id: "ask", label: "Ask before acting" },
  { id: "auto", label: "Auto" },
];

export function ModeSelector({ mode, onModeChange }) {
  return (
    <div
      role="radiogroup"
      aria-label="Permission mode"
      className="inline-flex overflow-hidden rounded-lg border border-border"
    >
      {MODES.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={mode === option.id}
          onClick={() => onModeChange(option.id)}
          className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition ${
            mode === option.id
              ? "bg-accent/20 text-accent"
              : "bg-canvas text-muted hover:text-text"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
