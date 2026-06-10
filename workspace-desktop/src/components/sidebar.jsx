import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

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

function FileTreeNode({
  entry,
  depth,
  childrenOf,
  toggleExpanded,
  isExpanded,
  isLoading,
  openContextMenu,
  onOpenFile,
}) {
  const expanded = isExpanded(entry.path);
  const loading = isLoading(entry.path);
  const children = childrenOf(entry.path);

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          entry.is_dir ? toggleExpanded(entry.path) : onOpenFile?.(entry.path)
        }
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
              onOpenFile={onOpenFile}
            />
          ))
        : null}
    </div>
  );
}

export function Sidebar({
  onAddToContext,
  onOpenFile,
  width,
  onResizeStart,
}) {
  const { config, saveConfig } = useAppConfig();
  const { projects, addProject } = useProjects();
  const activeProjectPath = config?.active_project ?? "";
  const activeProjectName = basename(activeProjectPath);
  const { childrenOf, toggleExpanded, isExpanded, isLoading } = useFileTree(activeProjectPath);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [globalSkills, setGlobalSkills] = useState([]);
  const [projectSkills, setProjectSkills] = useState([]);

  const refreshSkills = useCallback(async () => {
    try {
      const global = await invoke("list_global_skills");
      setGlobalSkills(global);

      if (activeProjectPath) {
        const scoped = await invoke("list_project_skills", {
          projectDir: activeProjectPath,
        });
        setProjectSkills(scoped);
      } else {
        setProjectSkills([]);
      }
    } catch (err) {
      console.error("Failed to load skills:", err);
    }
  }, [activeProjectPath]);

  useEffect(() => {
    void refreshSkills();
  }, [refreshSkills]);

  const isScopedToProject = (skillName) =>
    projectSkills.some((s) => s.name === skillName);

  const toggleSkillScope = async (skillName) => {
    if (!activeProjectPath) {
      return;
    }

    try {
      if (isScopedToProject(skillName)) {
        await invoke("unscope_skill_from_project", {
          skillName,
          projectDir: activeProjectPath,
        });
      } else {
        await invoke("scope_skill_to_project", {
          skillName,
          projectDir: activeProjectPath,
        });
      }
      await refreshSkills();
    } catch (err) {
      console.error("Failed to toggle skill scope:", err);
    }
  };

  const rootEntries = childrenOf(activeProjectPath);

  const activateProject = async (path) => {
    if (!config) {
      return;
    }

    try {
      await saveConfig({ ...config, active_project: path });
      setProjectMenuOpen(false);
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
    <aside
      className="flex shrink-0 flex-col border-r border-border bg-sidebar"
      style={{ width: `${width}px` }}
    >
      {/* Project header */}
      <div className="relative border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted">Project</p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleNewProject}
              className="rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-panel/70 hover:text-text"
              title="New project"
            >
              ＋
            </button>
            <button
              type="button"
              onClick={() => setProjectMenuOpen((c) => !c)}
              className="rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-panel/70 hover:text-text"
              title="Switch project"
            >
              ⇄
            </button>
          </div>
        </div>
        {activeProjectName ? (
          <p className="mt-1 truncate text-sm font-semibold text-text">{activeProjectName}</p>
        ) : null}

        {/* Project switcher dropdown */}
        {projectMenuOpen ? (
          <>
            <button
              type="button"
              aria-label="Close project switcher"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setProjectMenuOpen(false)}
            />
            <div className="absolute left-3 right-3 top-[calc(100%-0.25rem)] z-20 overflow-hidden rounded-xl border border-border bg-sidebar shadow-2xl">
              <div className="max-h-64 overflow-y-auto">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => void activateProject(project.path)}
                    className={`block w-full px-3 py-2.5 text-left transition hover:bg-panel/70 ${
                      project.path === activeProjectPath ? "bg-panel/80" : ""
                    }`}
                  >
                    <p className="truncate text-sm font-medium text-text">{project.name}</p>
                  </button>
                ))}
                {projects.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted">No projects saved.</div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-2">
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
              onOpenFile={onOpenFile}
            />
          ))
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted">
            <p>No project selected.</p>
            <button
              type="button"
              onClick={handleNewProject}
              className="mt-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/10"
            >
              Open Project
            </button>
          </div>
        )}
      </div>

      {/* Skills picker */}
      <div className="border-t border-border">
        <button
          type="button"
          onClick={() => setSkillsOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-panel/70"
        >
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
            Skills ({globalSkills.length})
          </span>
          <span className="text-xs text-muted">{skillsOpen ? "▼" : "▶"}</span>
        </button>

        {skillsOpen ? (
          <div className="max-h-48 overflow-y-auto pb-2">
            {globalSkills.length === 0 ? (
              <p className="px-4 py-2 text-xs text-muted">
                No skills installed. Install via Settings.
              </p>
            ) : (
              globalSkills.map((skill) => {
                const active = isScopedToProject(skill.name);
                return (
                  <button
                    key={skill.name}
                    type="button"
                    onClick={() => toggleSkillScope(skill.name)}
                    disabled={!activeProjectPath}
                    className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm transition hover:bg-panel/70 disabled:opacity-40"
                    title={
                      activeProjectPath
                        ? active
                          ? `Remove ${skill.name} from project`
                          : `Add ${skill.name} to project`
                        : "Select a project first"
                    }
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        active ? "bg-green-400" : "bg-border"
                      }`}
                    />
                    <span className="min-w-0 truncate text-text">{skill.name}</span>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      {/* Context menu */}
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

      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-accent/30 active:bg-accent/50"
        onMouseDown={onResizeStart}
      />
    </aside>
  );
}
