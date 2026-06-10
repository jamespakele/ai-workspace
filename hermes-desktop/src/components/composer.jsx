import { useEffect, useMemo, useState } from "react";

import { Button } from "./ui/button";
import { ModeSelector } from "./mode-selector";
import { buildCommandList, matchSlashCommands } from "@/lib/slash-commands";

export function Composer({
  pendingContextPath,
  onContextInjected,
  isStreaming,
  onSendPrompt,
  onUserMessage,
  mode,
  onModeChange,
  skills = [],
  onCompact,
  onOpenSchedule,
}) {
  const [text, setText] = useState("");
  const commands = useMemo(() => buildCommandList(skills), [skills]);
  const slashMatches = matchSlashCommands(text, commands);

  useEffect(() => {
    if (pendingContextPath === null) {
      return;
    }

    setText((current) => `@${pendingContextPath} ${current.trimStart()}`);
    onContextInjected();
  }, [onContextInjected, pendingContextPath]);

  const runBuiltin = (name) => {
    if (name === "compact") {
      onCompact?.();
      return true;
    }

    if (name === "schedule") {
      onOpenSchedule?.();
      return true;
    }

    return false;
  };

  const handleSelectCommand = (command) => {
    if (command.kind === "builtin" && runBuiltin(command.name)) {
      setText("");
      return;
    }

    setText(`/${command.name} `);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) {
      return;
    }

    const builtin = trimmed.match(/^\/(compact|schedule)\b/);
    if (builtin && runBuiltin(builtin[1])) {
      setText("");
      return;
    }

    onUserMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      toolCalls: [],
      isStreaming: false,
    });
    setText("");
    onSendPrompt(trimmed);
  };

  return (
    <div className="border-t border-border px-6 py-4">
      <div className="relative rounded-2xl border border-border bg-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <label className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
            Composer
          </label>
          <ModeSelector mode={mode} onModeChange={onModeChange} />
        </div>
        {slashMatches && slashMatches.length > 0 ? (
          <ul
            data-testid="slash-menu"
            className="absolute bottom-full left-4 right-4 z-20 mb-2 overflow-hidden rounded-xl border border-border bg-sidebar shadow-2xl"
          >
            {slashMatches.map((command) => (
              <li key={command.name}>
                <button
                  type="button"
                  onClick={() => handleSelectCommand(command)}
                  className="flex w-full items-baseline gap-3 px-4 py-2 text-left transition hover:bg-panel/70"
                >
                  <span className="font-mono text-sm text-accent">
                    /{command.name}
                  </span>
                  <span className="truncate text-xs text-muted">
                    {command.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <textarea
          className="mt-3 h-28 w-full resize-none rounded-xl border border-border bg-canvas px-3 py-3 text-sm text-text outline-none placeholder:text-muted disabled:opacity-50"
          placeholder={
            isStreaming ? "Hermes is thinking…" : "Message Hermes… ( / for commands)"
          }
          disabled={isStreaming}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
        />
        <div className="mt-4 flex items-center justify-end gap-3">
          <Button
            className="bg-accent text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!text.trim() || isStreaming}
            onClick={handleSend}
          >
            {isStreaming ? "Thinking…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
