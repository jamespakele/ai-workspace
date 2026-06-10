import { useState } from "react";

const STATUS_ICON = {
  pending: "○",
  running: "◐",
  done: "●",
  error: "✕",
};

const STATUS_CLASS = {
  pending: "text-muted",
  running: "text-accent animate-pulse",
  done: "text-green-400",
  error: "text-red-400",
};

// Cowork-style per-step progress, fed by gateway `plan.update` events.
export function PlanPanel({ plan }) {
  const steps = plan?.steps ?? [];
  const allDone =
    steps.length > 0 && steps.every((step) => step.status === "done");
  const [collapsed, setCollapsed] = useState(false);

  if (steps.length === 0) {
    return null;
  }

  const doneCount = steps.filter((step) => step.status === "done").length;

  return (
    <section
      data-testid="plan-panel"
      className="my-2 max-w-3xl rounded-xl border border-border bg-sidebar/60 px-4 py-3"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setCollapsed((value) => !value)}
        aria-expanded={!collapsed}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
          Plan
        </span>
        <span className="font-mono text-xs text-muted">
          {doneCount}/{steps.length} {allDone ? "✓" : ""}
        </span>
      </button>
      {!collapsed ? (
        <ol className="mt-2 space-y-1">
          {steps.map((step) => (
            <li key={step.id} className="flex items-center gap-2 text-sm">
              <span className={STATUS_CLASS[step.status] ?? "text-muted"}>
                {STATUS_ICON[step.status] ?? "○"}
              </span>
              <span
                className={
                  step.status === "done" ? "text-muted line-through" : "text-text"
                }
              >
                {step.title}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
