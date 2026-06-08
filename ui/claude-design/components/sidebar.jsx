// Sidebar — project switcher (dropdown), recursive file tree with right-click menu,
// and session history. Collapses to an icon rail (handled by parent via data-collapsed).

function ProjectSwitcher({ projects, onPick }) {
  const [open, setOpen] = React.useState(false);
  const active = projects.find((p) => p.active) || projects[0];
  return (
    <div className="proj">
      <button className={`proj-btn ${open ? "open" : ""}`} onClick={() => setOpen((o) => !o)}>
        <span className="proj-mark"><Icons.Cube size={15} /></span>
        <span className="proj-meta">
          <span className="proj-name">{active.name}</span>
          <span className="proj-path">{active.path}</span>
        </span>
        <Icons.ChevronDown size={14} className="proj-chev" />
      </button>
      {open && (
        <>
          <div className="menu-scrim" onClick={() => setOpen(false)} />
          <div className="proj-menu">
            <div className="menu-label">Projects</div>
            {projects.map((p) => (
              <button key={p.id} className={`proj-item ${p.active ? "active" : ""}`}
                onClick={() => { onPick && onPick(p.id); setOpen(false); }}>
                <Icons.Cube size={14} />
                <span className="proj-item-name">{p.name}</span>
                <span className="proj-item-path">{p.path.replace("~/", "")}</span>
                {p.active && <span className="proj-dot" />}
              </button>
            ))}
            <div className="menu-sep" />
            <button className="proj-item new">
              <Icons.Plus size={14} /> New project…
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function TreeNode({ node, depth, onContext }) {
  const [open, setOpen] = React.useState(!!node.open);
  const pad = { paddingLeft: 8 + depth * 13 };
  if (node.type === "dir") {
    const Chev = open ? Icons.ChevronDown : Icons.ChevronRight;
    const F = open ? Icons.FolderOpen : Icons.Folder;
    return (
      <div className={node.dim ? "tree-dim" : ""}>
        <button className="tree-row" style={pad} onClick={() => setOpen((o) => !o)}
          onContextMenu={(e) => onContext(e, node)}>
          <Chev size={13} className="tree-chev" />
          <F size={14} className="tree-ico folder" />
          <span className="tree-name">{node.name}</span>
        </button>
        {open && node.children.map((c, i) => (
          <TreeNode key={i} node={c} depth={depth + 1} onContext={onContext} />
        ))}
      </div>
    );
  }
  return (
    <button className={`tree-row file ${node.active ? "active" : ""}`} style={pad}
      onContextMenu={(e) => onContext(e, node)}>
      <span className="tree-chev-sp" />
      <Icons.File size={13} className="tree-ico file" />
      <span className="tree-name">{node.name}</span>
    </button>
  );
}

function ContextMenu({ menu, onClose, onAddContext }) {
  if (!menu) return null;
  return (
    <>
      <div className="menu-scrim" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="ctx-menu" style={{ left: menu.x, top: menu.y }}>
        <div className="ctx-file">{menu.node.name}</div>
        <button className="ctx-item" onClick={onClose}><Icons.Read size={13} /> Open file</button>
        <button className="ctx-item accent" onClick={() => { onAddContext(menu.node); onClose(); }}>
          <Icons.Plus size={13} /> Add to context
        </button>
        <button className="ctx-item" onClick={onClose}><Icons.Copy size={13} /> Copy path</button>
      </div>
    </>
  );
}

function Section({ icon, title, action, children, defaultOpen = true }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const I = Icons[icon];
  return (
    <div className={`side-section ${open ? "" : "closed"}`}>
      <div className="side-head">
        <button className="side-head-btn" onClick={() => setOpen((o) => !o)}>
          <Icons.ChevronDown size={12} className={`side-head-chev ${open ? "" : "rot"}`} />
          <span className="side-title">{title}</span>
        </button>
        {action}
      </div>
      {open && <div className="side-content">{children}</div>}
    </div>
  );
}

function Sidebar({ projects, tree, sessions, onAddContext, onPickSession, activeSession }) {
  const [menu, setMenu] = React.useState(null);
  const onContext = (e, node) => {
    e.preventDefault();
    const r = 8;
    setMenu({ x: Math.min(e.clientX, window.innerWidth - 190), y: e.clientY, node });
  };
  return (
    <aside className="sidebar">
      <div className="side-top">
        <ProjectSwitcher projects={projects} />
      </div>
      <div className="side-scroll">
        <Section icon="Folder" title="FILES"
          action={<button className="side-act" title="Collapse all"><Icons.Sidebar size={13} /></button>}>
          <div className="tree">
            {tree.map((n, i) => <TreeNode key={i} node={n} depth={0} onContext={onContext} />)}
          </div>
        </Section>
        <Section icon="History" title="SESSIONS"
          action={<button className="side-act" title="New session"><Icons.Plus size={14} /></button>}>
          <div className="sessions">
            {sessions.map((s) => (
              <button key={s.id} className={`session ${s.id === activeSession ? "active" : ""}`}
                onClick={() => onPickSession && onPickSession(s.id)}>
                <span className="session-bar" />
                <span className="session-meta">
                  <span className="session-title">{s.title}</span>
                  <span className="session-sub">{s.when} · {s.tokens} tok</span>
                </span>
              </button>
            ))}
          </div>
        </Section>
      </div>
      <ContextMenu menu={menu} onClose={() => setMenu(null)} onAddContext={onAddContext} />
    </aside>
  );
}

Object.assign(window, { Sidebar });
