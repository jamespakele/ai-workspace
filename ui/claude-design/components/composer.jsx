// Composer — multiline textarea, Shift+Enter newline / Enter send, attach chips above,
// paperclip, and a floating slash-command palette that opens on "/".

function SlashPalette({ query, onPick, active }) {
  const items = SLASH_COMMANDS.filter((c) => c.cmd.startsWith(query));
  if (!items.length) return null;
  return (
    <div className="slash-pal">
      <div className="slash-head"><Icons.Slash size={12} /> commands</div>
      {items.map((c, i) => {
        const I = Icons[c.icon] || Icons.Terminal;
        return (
          <button key={c.cmd} className={`slash-item ${i === active ? "on" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); onPick(c); }}>
            <span className="slash-ico"><I size={14} /></span>
            <span className="slash-cmd">{c.cmd}</span>
            <span className="slash-desc">{c.desc}</span>
          </button>
        );
      })}
    </div>
  );
}

function Composer({ chips, onRemoveChip, onSend, busy, onStop }) {
  const [val, setVal] = React.useState("");
  const [slash, setSlash] = React.useState(null); // query string or null
  const [activeIdx, setActiveIdx] = React.useState(0);
  const ref = React.useRef(null);

  const autosize = () => {
    const el = ref.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  };
  React.useEffect(autosize, [val]);

  const handleChange = (e) => {
    const v = e.target.value;
    setVal(v);
    const m = v.match(/(^|\s)(\/[a-z]*)$/i);
    if (v === "/" || (m && v.startsWith("/") && !v.includes(" "))) { setSlash(v); setActiveIdx(0); }
    else if (v.startsWith("/") && !v.includes(" ")) { setSlash(v); setActiveIdx(0); }
    else setSlash(null);
  };

  const filtered = slash != null ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(slash)) : [];

  const pickSlash = (c) => {
    setVal(c.cmd + " ");
    setSlash(null);
    ref.current && ref.current.focus();
  };

  const send = () => {
    const text = val.trim();
    if (!text || busy) return;
    onSend(text);
    setVal("");
    setSlash(null);
  };

  const onKey = (e) => {
    if (slash != null && filtered.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % filtered.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) { e.preventDefault(); pickSlash(filtered[activeIdx]); return; }
      if (e.key === "Escape") { setSlash(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="composer-wrap">
      {slash != null && filtered.length > 0 && (
        <SlashPalette query={slash} active={activeIdx} onPick={pickSlash} />
      )}
      <div className={`composer ${busy ? "busy" : ""}`}>
        {chips.length > 0 && (
          <div className="chips">
            {chips.map((c, i) => (
              <span className="chip" key={i}>
                <Icons.File size={12} />
                <span className="chip-name">{c.name}</span>
                <button className="chip-x" onClick={() => onRemoveChip(i)}><Icons.X size={11} /></button>
              </span>
            ))}
          </div>
        )}
        <div className="composer-row">
          <button className="comp-attach" title="Attach file or image"><Icons.Paperclip size={17} /></button>
          <textarea ref={ref} className="comp-input" rows={1} value={val}
            onChange={handleChange} onKeyDown={onKey}
            placeholder="Message Hermes…  /  for commands · Shift+Enter for newline" />
          {busy ? (
            <button className="comp-send stop" onClick={onStop} title="Stop"><Icons.Stop size={15} /></button>
          ) : (
            <button className={`comp-send ${val.trim() ? "ready" : ""}`} onClick={send} title="Send"><Icons.Send size={16} /></button>
          )}
        </div>
        <div className="composer-foot">
          <span className="foot-hint"><kbd>/</kbd> commands</span>
          <span className="foot-hint"><kbd>⇧</kbd><kbd>↵</kbd> newline</span>
          <span className="foot-hint"><kbd>↵</kbd> send</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Composer });
