export function Message({ message }) {
  const isAssistant = message.role === "assistant";

  return (
    <article
      className={`max-w-3xl rounded-2xl border px-4 py-3 ${
        isAssistant
          ? "border-border bg-panel text-text"
          : "ml-auto border-accent/40 bg-accent/10 text-text"
      }`}
    >
      <p className="mb-2 font-mono text-xs uppercase tracking-[0.24em] text-muted">
        {message.role}
      </p>
      <p className="text-sm leading-6">{message.content}</p>
    </article>
  );
}
