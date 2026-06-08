import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

import { useAppConfig } from "@/hooks/useAppConfig";
import { useFileTree } from "@/hooks/useFileTree";
import { useProjects } from "@/hooks/useProjects";

function basename(path) {
  if (!path) {
    return "";
  }

  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? path;
}

function truncateTail(value, length) {
  if (!value) {
    return "";
  }

  return value.length > length ? `…${value.slice(-length)}` : value;
}

function FileTreeNode({
  entry,
  depth,
  childrenOf,
  toggleExpanded,
  isExpanded,
  isLoading,
  openContextMenu,
}) {
  const expanded = isExpanded(entry.path);
  const loading = isLoading(entry.path);
  const children = childrenOf(entry.path);

  return (
    <div>
      <button
        type="button"
        onClick={() => entry.is_dir && toggleExpanded(entry.path)}
        onContextMenu={(event) => openContextMenu(event, entry)}
        className="flex w-full items-center gap-2 rounded-lg py-1 pr-2 text-left transition hover:bg-panel/70"
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        <span className="w-4 shrink-0 text-muted">{entry.is_dir ? (expanded ? "▼" : "▶") : ""}</span>
        <span className="truncate text-sm text-text">{entry.name}</span>
        {entry.is_dir && loading ? <span className="text-sm text-muted">…</span> : null}
      </button>
      {entry.is_dir && expanded
        ? children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              childrenOf={childrenOf}
              toggleExpanded={toggleExpanded}
              isExpanded={isExpanded}
              isLoading={isLoading}
              openContextMenu={openContextMenu}
            />
          ))
        : null}
    </div>
  );
}

export function Sidebar({ onAddToContext }) {
  const { config, saveConfig } = useAppConfig();
  const { projects, addProject } = useProjects();
  const activeProjectPath = config?.active_project ?? "";
  const activeProjectName = basename(activeProjectPath);
  const { childrenOf, toggleExpanded, isExpanded, isLoading } = useFileTree(activeProjectPath);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  const rootEntries = childrenOf(activeProjectPath);

  const activateProject = async (path) => {
    if (!config) {
      return;
    }

    try {
      await saveConfig({ ...config, active_project: path });
      setProjectDropdownOpen(false);
    } catch (error) {
      console.error("save_config failed:", error);
    }
  };

  const handleNewProject = async () => {
    try {
      const selection = await open({ directory: true });
      const path = typeof selection === "string" ? selection : null;

      if (!path) {
        return;
      }

      await addProject(path);
      await activateProject(path);
    } catch (error) {
      console.error("new project flow failed:", error);
    }
  };

  const openContextMenu = (event, entry) => {
    event.preventDefault();
    setContextMenu({
      entry,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleCopyPath = async () => {
    if (!contextMenu) {
      return;
    }

    try {
      await navigator.clipboard.writeText(contextMenu.entry.path);
    } catch (error) {
      console.error("clipboard write failed:", error);
    } finally {
      closeContextMenu();
    }
  };

  const handleAddToContext = () => {
    if (!contextMenu) {
      return;
    }

    onAddToContext?.(contextMenu.entry.path);
    closeContextMenu();
  };

  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-border bg-sidebar">
      <section className="relative border-b border-border px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">Projects</p>
            <h2 className="mt-2 truncate text-base font-semibold text-text">
              {activeProjectName || "Workspace"}
            </h2>
            <p className="mt-1 font-mono text-xs text-muted">
              {activeProjectPath
                ? truncateTail(activeProjectPath, 30)
                : projects.length === 0
                  ? "No projects saved."
                  : "No project selected."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setProjectDropdownOpen((current) => !current);
              closeContextMenu();
            }}
            className="rounded-xl border border-border bg-panel/60 px-3 py-2 text-xs uppercase tracking-[0.18em] text-muted transition hover:border-accent/40 hover:text-text"
          >
            {projectDropdownOpen ? "Close" : "Switch"}
          </button>
        </div>

        {projectDropdownOpen ? (
          <>
            <button
              type="button"
              aria-label="Close project switcher"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setProjectDropdownOpen(false)}
            />
            <div className="absolute left-4 right-4 top-[calc(100%-0.25rem)] z-20 overflow-hidden rounded-2xl border border-border bg-sidebar shadow-2xl">
              <button
                type="button"
                onClick={handleNewProject}
                className="flex w-full items-center justify-between border-b border-border px-4 py-3 text-left text-sm text-accent transition hover:bg-panel/80"
              >
                <span className="font-medium">＋ New Project</span>
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
                  Folder
                </span>
              </button>
              <div className="max-h-72 overflow-y-auto">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => void activateProject(project.path)}
                    className={`block w-full px-4 py-3 text-left transition hover:bg-panel/70 ${
                      project.path === activeProjectPath ? "bg-panel/80" : ""
                    }`}
                  >
                    <p className="truncate text-sm font-medium text-text">{project.name}</p>
                    <p className="mt-1 font-mono text-xs text-muted">
                      {truncateTail(project.path, 30)}
                    </p>
                  </button>
                ))}
                {projects.length === 0 ? (
                  <div className="px-4 py-5 text-sm text-muted">
                    {activeProjectPath ? "No saved projects." : "No projects saved."}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </section>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">File Tree</p>
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          {activeProjectPath ? (
            rootEntries.map((entry) => (
              <FileTreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                childrenOf={childrenOf}
                toggleExpanded={toggleExpanded}
                isExpanded={isExpanded}
                isLoading={isLoading}
                openContextMenu={openContextMenu}
              />
            ))
          ) : (
            <div className="px-4 text-sm text-muted">No project selected.</div>
          )}
        </div>
      </section>

      {contextMenu ? (
        <>
          <button
            type="button"
            aria-label="Close context menu"
            className="fixed inset-0 z-20 cursor-default"
            onClick={closeContextMenu}
          />
          <div
            className="fixed z-30 min-w-40 overflow-hidden rounded-xl border border-border bg-sidebar shadow-2xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              type="button"
              onClick={handleCopyPath}
              className="block w-full px-4 py-2 text-left text-sm text-text transition hover:bg-panel/70"
            >
              Copy path
            </button>
            <button
              type="button"
              onClick={handleAddToContext}
              className="block w-full px-4 py-2 text-left text-sm text-text transition hover:bg-panel/70"
            >
              Add to context
            </button>
          </div>
        </>
      ) : null}
    </aside>
  );
}
