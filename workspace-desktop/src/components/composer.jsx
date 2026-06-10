import { useEffect, useState } from "react";
import { invoke } from "@/lib/api";

export function Composer({
  pendingContextPath,
  onContextInjected,
  isStreaming,
  onSendPrompt,
  onUserMessage,
  agents = [],
  activeAgent,
  onAgentChange,
  activeModel,
  onModelChange,
  models = [],
}) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) {
      return;
    }

    let prompt = trimmed;

    // If a file was added to context, prepend it.
    if (pendingContextPath) {
      prompt = `[context: ${pendingContextPath}]\n\n${prompt}`;
      onContextInjected?.();
    }

    // Add the user message to the chat.
    onUserMessage?.({
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      toolCalls: [],
      isStreaming: false,
    });

    setText("");
    onSendPrompt?.(prompt);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  // Display-friendly model name: strip provider prefix
  const modelDisplayName = (id) => {
    const parts = id.split("/");
    return parts.length > 1 ? parts.slice(1).join("/") : id;
  };

  return (
    <div className="border-t border-border bg-sidebar px-6 py-4">
      {/* Context badge */}
      {pendingContextPath ? (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 text-xs text-accent">
          <span className="truncate">📎 {pendingContextPath}</span>
          <button
            type="button"
            onClick={onContextInjected}
            className="ml-auto shrink-0 text-muted hover:text-text"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Input */}
      <textarea
        className="h-24 w-full resize-none rounded-xl border border-border bg-canvas px-4 py-3 text-sm text-text outline-none placeholder:text-muted focus:border-accent/50 disabled:opacity-50"
        placeholder={
          isStreaming ? "Agent is thinking…" : "Message your agent… (Shift+Enter for new line)"
        }
        disabled={isStreaming}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      {/* Agent + Model info + send button */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-4 font-mono text-xs text-muted">
          {/* Agent selector */}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            agent:
            <select
              value={activeAgent || "hermes"}
              onChange={(e) => onAgentChange?.(e.target.value)}
              className="cursor-pointer rounded border border-border bg-canvas px-2 py-0.5 text-xs text-text outline-none transition hover:border-accent/50 focus:border-accent"
            >
              {agents.length === 0 ? (
                <option value="hermes">hermes</option>
              ) : (
                agents.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))
              )}
            </select>
          </span>

          {/* Model selector */}
          <span className="inline-flex items-center gap-1.5">
            model:
            <select
              value={activeModel || ""}
              onChange={(e) => onModelChange?.(e.target.value)}
              className="cursor-pointer rounded border border-border bg-canvas px-2 py-0.5 text-xs text-text outline-none transition hover:border-accent/50 focus:border-accent"
            >
              <option value="">default</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {modelDisplayName(m)}
                </option>
              ))}
            </select>
          </span>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isStreaming || !text.trim()}
          className="rounded-xl bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
        >
          {isStreaming ? "Thinking…" : "Send"}
        </button>
      </div>
    </div>
  );
}
