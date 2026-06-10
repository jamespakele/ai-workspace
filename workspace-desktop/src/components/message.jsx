import { Markdown } from "./markdown";
import { ToolCallCard } from "./toolcard";

export function UserMessage({ message }) {
  return (
    <article className="flex justify-end">
      <div className="ml-auto max-w-[80%] rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
          YOU
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text">
          {message.content}
        </p>
      </div>
    </article>
  );
}

export function AssistantMessage({ message }) {
  return (
    <article className="max-w-3xl">
      <div className="text-text">
        {message.content ? <Markdown content={message.content} /> : null}
        {message.isStreaming ? (
          <span className="animate-pulse text-accent">▋</span>
        ) : null}
      </div>
      {message.toolCalls.map((toolCall) => (
        <ToolCallCard key={toolCall.id} toolCall={toolCall} />
      ))}
    </article>
  );
}
