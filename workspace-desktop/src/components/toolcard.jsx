import { useEffect, useRef, useState } from "react";

function formatResult(result) {
  if (typeof result !== "string") {
    return "";
  }

  return result.length > 500 ? `${result.slice(0, 500)}...` : result;
}

export function ToolCallCard({ toolCall }) {
  const [expanded, setExpanded] = useState(true);
  const previousStatusRef = useRef(toolCall.status);

  useEffect(() => {
    if (
      previousStatusRef.current === "running" &&
      toolCall.status === "done"
    ) {
      setExpanded(false);
    }

    previousStatusRef.current = toolCall.status;
  }, [toolCall.status]);

  return (
    <section className="my-2 rounded-xl border border-border bg-sidebar/60 px-4 py-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="font-mono text-sm text-text">{toolCall.name}</span>
        {toolCall.status === "running" ? (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        ) : (
          <span className="text-accent">✓</span>
        )}
      </button>

      {expanded ? (
        <div>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-canvas p-3 font-mono text-[11px] text-muted">
            {JSON.stringify(toolCall.args, null, 2)}
          </pre>
          {toolCall.status === "running" && toolCall.partialOutput ? (
            <pre className="mt-2 overflow-x-auto rounded-lg bg-canvas p-3 font-mono text-[11px] text-muted">
              {toolCall.partialOutput}
            </pre>
          ) : null}
          {toolCall.status === "done" && toolCall.result !== null ? (
            <pre className="mt-2 overflow-x-auto rounded-lg bg-canvas p-3 font-mono text-[11px] text-muted">
              {formatResult(toolCall.result)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
