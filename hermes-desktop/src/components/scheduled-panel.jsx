import { useEffect, useState } from "react";

import { computeNextRun, parseCadence } from "@/lib/cadence";

function formatNextRun(task) {
  if (!task.enabled) {
    return "paused";
  }

  const reference = task.last_run ? new Date(task.last_run * 1000) : new Date();
  const next = computeNextRun(task.cadence, reference);
  if (!next) {
    return "invalid cadence";
  }

  return `next: ${next.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

const EMPTY_FORM = { name: "", prompt: "", cadence: "" };

// Cowork's "Scheduled" sidebar section: recurring tasks that run with the
// same gateway capabilities as a typed prompt.
export function ScheduledPanel({
  tasks,
  onAdd,
  onRemove,
  onToggle,
  createOpen,
  onCreateOpenChange,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (createOpen) {
      setForm(EMPTY_FORM);
      setFormError("");
    }
  }, [createOpen]);

  const handleCreate = async () => {
    const name = form.name.trim();
    const prompt = form.prompt.trim();
    const cadence = form.cadence.trim();

    if (!name || !prompt) {
      setFormError("Name and prompt are required.");
      return;
    }

    if (!parseCadence(cadence)) {
      setFormError(
        "Invalid cadence. Use hourly, daily@HH:MM, weekly:day@HH:MM, or every:Nm.",
      );
      return;
    }

    await onAdd({ name, prompt, cadence });
    onCreateOpenChange(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">
          Scheduled
        </p>
        <button
          type="button"
          onClick={() => onCreateOpenChange(!createOpen)}
          className="rounded-lg border border-border px-2 py-1 text-xs text-muted transition hover:border-accent/40 hover:text-text"
        >
          {createOpen ? "Cancel" : "+ New task"}
        </button>
      </div>

      {createOpen ? (
        <div className="space-y-2 border-b border-border px-4 pb-4">
          <input
            type="text"
            placeholder="Task name"
            aria-label="Task name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-accent"
          />
          <textarea
            placeholder="Prompt to run"
            aria-label="Task prompt"
            value={form.prompt}
            onChange={(event) =>
              setForm((current) => ({ ...current, prompt: event.target.value }))
            }
            className="h-20 w-full resize-none rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-accent"
          />
          <input
            type="text"
            placeholder="Cadence (e.g. daily@09:00)"
            aria-label="Task cadence"
            value={form.cadence}
            onChange={(event) =>
              setForm((current) => ({ ...current, cadence: event.target.value }))
            }
            className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-accent"
          />
          {formError ? <p className="text-xs text-red-400">{formError}</p> : null}
          <button
            type="button"
            onClick={() => void handleCreate()}
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm text-white transition hover:bg-accent/90"
          >
            Create task
          </button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {tasks.length === 0 && !createOpen ? (
          <p className="px-4 py-2 text-sm text-muted">
            No scheduled tasks. Create one to run prompts on a cadence.
          </p>
        ) : null}
        {tasks.map((task) => (
          <div
            key={task.id}
            className="group flex items-start justify-between gap-2 px-4 py-2 transition hover:bg-panel/60"
          >
            <div className="min-w-0">
              <p
                className={`truncate text-sm ${task.enabled ? "text-text" : "text-muted line-through"}`}
              >
                {task.name}
              </p>
              <p className="mt-0.5 font-mono text-xs text-muted">
                {task.cadence} · {formatNextRun(task)}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => onToggle(task.id)}
                aria-label={`${task.enabled ? "Pause" : "Resume"} ${task.name}`}
                className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-panel hover:text-text"
              >
                {task.enabled ? "⏸" : "▶"}
              </button>
              <button
                type="button"
                onClick={() => onRemove(task.id)}
                aria-label={`Delete ${task.name}`}
                className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
