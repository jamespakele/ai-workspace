// ToolCallCard — distinct bordered card with a header row (icon + name + status),
// collapsible. Open by default, collapses after completion if the user wants.
// Renders 3 body kinds: read (line refs), diff (+/- hunk), terminal (mono output).

const TOOL_META = {
  Read: { label: "Read file", color: "blue" },
  Edit: { label: "Edit file", color: "green" },
  Terminal: { label: "Run command", color: "blue" },
  Search2: { label: "Search", color: "blue" },
  Check: { label: "Run tests", color: "green" },
};

function ToolBody({ body }) {
  if (body.kind === "read") {
    return (
      <div className="tc-body tc-read">
        {body.lines.map((l, i) => (
          <div className="tc-line" key={i}>
            <span className="tc-gutter">{l.n}</span>
            <span className="tc-code">{l.t}</span>
          </div>
        ))}
      </div>
    );
  }
  if (body.kind === "diff") {
    return (
      <div className="tc-body tc-diff">
        <div className="tc-hunk">{body.hunk}</div>
        {body.lines.map((l, i) => (
          <div className={`tc-line dl-${l.sign === "+" ? "add" : l.sign === "-" ? "del" : "ctx"}`} key={i}>
            <span className="tc-sign">{l.sign === " " ? "" : l.sign}</span>
            <span className="tc-code">{l.t || "\u200b"}</span>
          </div>
        ))}
      </div>
    );
  }
  if (body.kind === "terminal") {
    return (
      <div className="tc-body tc-term">
        {body.lines.map((l, i) => (
          <div className="tc-tline" key={i}>{l || "\u200b"}</div>
        ))}
      </div>
    );
  }
  return null;
}

function ToolCallCard({ block }) {
  const meta = TOOL_META[block.tool] || { label: block.tool, color: "blue" };
  const [open, setOpen] = React.useState(block.status !== "done" ? true : true);
  const TIcon = Icons[block.tool] || Icons.Terminal;
  return (
    <div className={`toolcard tc-${meta.color}`} data-status={block.status}>
      <button className="tc-head" onClick={() => setOpen((o) => !o)}>
        <span className="tc-rail" />
        <span className="tc-ico"><TIcon size={14} /></span>
        <span className="tc-label">{meta.label}</span>
        <span className="tc-title">{block.title}</span>
        <span className="tc-sub">{block.subtitle}</span>
        <span className="tc-spacer" />
        <span className={`tc-status st-${block.status}`}>
          {block.status === "running" ? (
            <><span className="tc-spin" /> running</>
          ) : (
            <><Icons.Check size={12} /> done</>
          )}
        </span>
        <span className={`tc-chev ${open ? "open" : ""}`}><Icons.ChevronRight size={14} /></span>
      </button>
      {open && <ToolBody body={block.body} />}
    </div>
  );
}

Object.assign(window, { ToolCallCard });
