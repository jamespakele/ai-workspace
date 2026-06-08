// App — Tauri-style window shell: titlebar, three-panel body (sidebar · chat · ),
// status bar. Owns conversation state, the streaming engine, and tweaks.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "density": "medium",
  "toolcard": "distinct"
}/*EDITMODE-END*/;

// deep clone helper
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---- a canned agent reply used when the user sends a message ----
function makeReply(userText) {
  const t = userText.toLowerCase();
  const blocks = [];
  blocks.push({ type: "thinking", collapsed: true, md: "Parsing the request and deciding which tools I need. I'll check the relevant file before proposing changes so I match the existing style." });
  if (t.includes("toast") || t.includes("reconnect")) {
    blocks.push({ type: "tool", tool: "Edit", title: "chat_view.tsx", subtitle: "ui/chat_view.tsx · +12 −0", status: "done",
      body: { kind: "diff", hunk: "@@ -40,6 +40,18 @@ export function ChatView() {", lines: [
        { sign: "+", t: "  useEffect(() => {" },
        { sign: "+", t: "    return client.on_state((s) => {" },
        { sign: "+", t: "      if (s === 'RETRYING') showToast('Reconnecting…')" },
        { sign: "+", t: "      if (s === 'ONLINE') dismissToast()" },
        { sign: "+", t: "    })" },
        { sign: "+", t: "  }, [])" },
      ] } });
  }
  blocks.push({ type: "text", stream: true, full: t.includes("toast") || t.includes("reconnect")
    ? "Added a **reconnecting toast** to the chat view, wired to the same `on_state` observer. It appears only while state is `RETRYING` and auto-dismisses on `ONLINE`, so the status-bar dot and the toast stay in sync.\n\nAnything else you want surfaced — a retry countdown, or a manual *Reconnect now* button?"
    : "Got it. I've scoped the change and it's ready to apply. Let me know if you'd like me to run the test suite or open a diff before committing.\n\nWant me to proceed?" });
  return { id: "r" + Date.now(), role: "assistant", blocks };
}

function prepareInitial() {
  const msgs = clone(INITIAL_MESSAGES);
  // stash + blank the streaming block so it types in on mount
  for (const m of msgs) {
    m.blocks.forEach((b) => {
      if (b.type === "text" && b.stream) { b.full = b.md; b.md = ""; }
    });
  }
  return msgs;
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [messages, setMessages] = React.useState(prepareInitial);
  const [streamingId, setStreamingId] = React.useState(null);
  const [chips, setChips] = React.useState([]);
  const [model, setModel] = React.useState(MODELS[0]);
  const [activeSession, setActiveSession] = React.useState("a1f");
  const [connection, setConnection] = React.useState("online");
  const scrollRef = React.useRef(null);
  const timerRef = React.useRef(null);

  const scrollToBottom = (smooth) => {
    const el = scrollRef.current; if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  // stream a block's `full` text into `md`
  const streamBlock = (msgId, blockIdx, full, after) => {
    setStreamingId(msgId);
    let i = 0;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      // reveal a few chars per tick, snapping on spaces for a token feel
      i = Math.min(full.length, i + (3 + Math.floor(Math.random() * 4)));
      while (i < full.length && !" \n.,;)".includes(full[i])) i++;
      setMessages((prev) => prev.map((m) => {
        if (m.id !== msgId) return m;
        const nm = clone(m);
        nm.blocks[blockIdx].md = full.slice(0, i);
        return nm;
      }));
      const el = scrollRef.current;
      if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) scrollToBottom(false);
      if (i >= full.length) {
        clearInterval(timerRef.current);
        setStreamingId(null);
        after && after();
      }
    }, 38);
  };

  // kick off the initial streaming reply once
  React.useEffect(() => {
    const last = messages[messages.length - 1];
    const idx = last.blocks.findIndex((b) => b.type === "text" && b.full);
    if (idx >= 0) {
      const id = setTimeout(() => streamBlock(last.id, idx, last.blocks[idx].full), 450);
      return () => clearTimeout(id);
    }
  }, []);

  React.useEffect(() => () => clearInterval(timerRef.current), []);

  const addContext = (node) => {
    setChips((c) => c.find((x) => x.name === node.name) ? c : [...c, { name: node.name }]);
  };

  const onSend = (text) => {
    const userMsg = { id: "u" + Date.now(), role: "user", blocks: [{ type: "text", md: text }],
      attachments: chips.length ? chips.map((c) => ({ name: c.name, kind: "file" })) : undefined };
    const reply = makeReply(text);
    const sIdx = reply.blocks.findIndex((b) => b.type === "text" && b.full);
    const full = sIdx >= 0 ? reply.blocks[sIdx].full : "";
    if (sIdx >= 0) reply.blocks[sIdx].md = "";
    setChips([]);
    setMessages((prev) => [...prev, userMsg, reply]);
    setTimeout(() => scrollToBottom(true), 30);
    // simulate latency then stream
    setStreamingId(reply.id);
    setTimeout(() => streamBlock(reply.id, sIdx, full), 620);
  };

  const onStop = () => { clearInterval(timerRef.current); setStreamingId(null); };

  return (
    <div className="app" data-theme={t.theme} data-density={t.density} data-toolcard={t.toolcard}>
      {/* titlebar */}
      <div className="titlebar">
        <div className="tb-left">
          <button className="tb-icon" title="Toggle sidebar"><Icons.Sidebar size={15} /></button>
          <span className="tb-brand"><Icons.Hermes size={16} /> Hermes</span>
        </div>
        <div className="tb-center">
          <span className="tb-context"><Icons.Cube size={12} /> hermes-gateway</span>
        </div>
        <div className="tb-right">
          <button className="tb-icon"><Icons.Settings size={15} /></button>
          <div className="tb-win">
            <span className="win-btn min" /><span className="win-btn max" /><span className="win-btn close" />
          </div>
        </div>
      </div>

      <div className="body">
        <Sidebar projects={PROJECTS} tree={FILE_TREE} sessions={SESSIONS}
          onAddContext={addContext} activeSession={activeSession} onPickSession={setActiveSession} />

        <main className="main">
          <div className="chat-head">
            <div className="ch-title">
              <span className="ch-name">Reconnect logic + status surface</span>
              <span className="ch-sub">{messages.length} messages · started 14 min ago</span>
            </div>
            <div className="ch-actions">
              <button className="ch-btn"><Icons.History size={14} /> History</button>
              <button className="ch-btn"><Icons.Copy size={14} /> Share</button>
            </div>
          </div>

          <div className="thread" ref={scrollRef}>
            <div className="thread-inner">
              {messages.map((m) => (
                <ChatMessage key={m.id} msg={m} streamingId={streamingId} />
              ))}
              {streamingId && !messages.find((m) => m.id === streamingId)?.blocks.some((b) => b.md) && (
                <div className="working"><span className="working-dot" /><span className="working-dot" /><span className="working-dot" /> Hermes is working…</div>
              )}
              <div className="thread-pad" />
            </div>
          </div>

          <div className="composer-shell">
            <Composer chips={chips} onRemoveChip={(i) => setChips((c) => c.filter((_, k) => k !== i))}
              onSend={onSend} busy={!!streamingId} onStop={onStop} />
          </div>
        </main>
      </div>

      <StatusBar model={model} models={MODELS} onPickModel={setModel}
        project="hermes-gateway" sessionId="sess_a1f3·9e" tokens="18.4k" connection={connection} />

      <TweaksPanel>
        <TweakSection label="Appearance" />
        <TweakRadio label="Theme" value={t.theme} options={["dark", "light"]}
          onChange={(v) => setTweak("theme", v)} />
        <TweakRadio label="Density" value={t.density} options={["compact", "medium", "comfy"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakSection label="Tool calls" />
        <TweakRadio label="Card style" value={t.toolcard} options={["subtle", "distinct", "bold"]}
          onChange={(v) => setTweak("toolcard", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
