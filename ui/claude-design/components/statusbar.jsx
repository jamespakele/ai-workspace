// StatusBar — always-visible bottom strip: connection dot, model switcher (click to
// swap), active project, session id, token usage.

function ModelSwitcher({ model, models, onPick, connection }) {
  const [open, setOpen] = React.useState(false);
  const groups = [...new Set(models.map((m) => m.group))];
  return (
    <div className="model-sw">
      <button className={`sb-item model-btn ${open ? "open" : ""}`} onClick={() => setOpen((o) => !o)}>
        <Icons.Cube size={13} />
        <span className="model-name">{model.name}</span>
        <span className="model-via">via {model.provider}</span>
        <Icons.ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div className="menu-scrim" onClick={() => setOpen(false)} />
          <div className="model-menu">
            {groups.map((g) => (
              <div key={g}>
                <div className="menu-label">{g}</div>
                {models.filter((m) => m.group === g).map((m) => (
                  <button key={m.id} className={`model-item ${m.id === model.id ? "active" : ""}`}
                    onClick={() => { onPick(m); setOpen(false); }}>
                    <Icons.Cube size={13} />
                    <span className="model-item-name">{m.name}</span>
                    {m.id === model.id && <Icons.Check size={13} className="model-check" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatusBar({ model, models, onPickModel, project, sessionId, tokens, connection }) {
  const connMeta = {
    online: { c: "ok", t: "connected" },
    retrying: { c: "warn", t: "reconnecting…" },
    offline: { c: "bad", t: "offline" },
  }[connection];
  return (
    <footer className="statusbar">
      <div className="sb-left">
        <span className={`sb-item conn conn-${connMeta.c}`} title={`ws://localhost:8765 · ${connMeta.t}`}>
          <span className="conn-dot" />
          {connMeta.t}
        </span>
        <span className="sb-div" />
        <ModelSwitcher model={model} models={models} onPick={onPickModel} connection={connection} />
      </div>
      <div className="sb-right">
        <span className="sb-item ghost"><Icons.Cube size={12} /> {project}</span>
        <span className="sb-div" />
        <span className="sb-item ghost mono" title="session id">{sessionId}</span>
        <span className="sb-div" />
        <span className="sb-item ghost" title="session token usage">
          <span className="tok-bar"><span className="tok-fill" style={{ width: "37%" }} /></span>
          {tokens} tok
        </span>
        <span className="sb-div" />
        <button className="sb-item ghost btn"><Icons.Settings size={13} /></button>
      </div>
    </footer>
  );
}

Object.assign(window, { StatusBar });
