import { useEffect, useState } from "react";

import { Button } from "./ui/button";

export function Composer({
  pendingContextPath,
  onContextInjected,
  isStreaming,
  send,
  activeSessionId,
  onUserMessage,
}) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (pendingContextPath === null) {
      return;
    }

    setText((current) => `@${pendingContextPath} ${current.trimStart()}`);
    onContextInjected();
  }, [onContextInjected, pendingContextPath]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) {
      return;
    }

    send("prompt.submit", {
      text: trimmed,
      session_id: activeSessionId,
    });
    onUserMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      toolCalls: [],
      isStreaming: false,
    });
    setText("");
  };

  return (
    <div className="border-t border-border px-6 py-4">
      <div className="rounded-2xl border border-border bg-panel p-4">
        <label className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
          Composer
        </label>
        <textarea
          className="mt-3 h-28 w-full resize-none rounded-xl border border-border bg-canvas px-3 py-3 text-sm text-text outline-none placeholder:text-muted"
          placeholder="Message Hermes…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
        />
        <div className="mt-4 flex justify-end">
          <Button
            className="bg-accent text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isStreaming}
            onClick={handleSend}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
