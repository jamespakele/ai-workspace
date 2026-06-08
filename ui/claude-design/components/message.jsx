// ChatMessage — renders user / assistant messages as a flat thread (no bubbles for
// assistant; subtle treatment for user). Iterates blocks: text, thinking, tool, code.

function ThinkingBlock({ block }) {
  const [open, setOpen] = React.useState(!block.collapsed);
  return (
    <div className={`thinking ${open ? "open" : ""}`}>
      <button className="think-head" onClick={() => setOpen((o) => !o)}>
        <Icons.Brain size={13} />
        <span>Thought for a moment</span>
        <span className={`think-chev ${open ? "open" : ""}`}><Icons.ChevronRight size={13} /></span>
      </button>
      {open && (
        <div className="think-body">
          <Markdown md={block.md} />
        </div>
      )}
    </div>
  );
}

function Block({ block, streaming }) {
  switch (block.type) {
    case "thinking": return <ThinkingBlock block={block} />;
    case "tool": return <ToolCallCard block={block} />;
    case "text": return <Markdown md={block.md} cursor={streaming && block.stream} />;
    default: return null;
  }
}

function ChatMessage({ msg, streamingId }) {
  if (msg.role === "user") {
    return (
      <div className="msg msg-user" data-screen-label="user message">
        <div className="msg-rail">
          <span className="avatar av-user">you</span>
        </div>
        <div className="msg-body">
          {msg.attachments && (
            <div className="msg-attachments">
              {msg.attachments.map((a, i) => (
                <span className="attach-chip" key={i}>
                  <Icons.File size={12} />
                  {a.name}
                </span>
              ))}
            </div>
          )}
          {msg.blocks.map((b, i) => <Block key={i} block={b} />)}
        </div>
      </div>
    );
  }
  return (
    <div className="msg msg-assistant">
      <div className="msg-rail">
        <span className="avatar av-bot"><Icons.Hermes size={16} /></span>
      </div>
      <div className="msg-body">
        <div className="msg-author">Hermes</div>
        {msg.blocks.map((b, i) => (
          <Block key={i} block={b} streaming={streamingId === msg.id} />
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { ChatMessage });
