---
story_id: "STORY-0005"
title: "Sidebar: Project Switcher & File Tree"
status: "COMPLETED"
qa_status: "PASS"
po_alignment: "APPROVED"
created_at: "2026-06-08"
updated_at: "2026-06-08"
---

# Story 5.1: Sidebar: Project Switcher & File Tree

Status: pending-qa

## Story

As a developer using Hermes Desktop,
I want to see my saved projects in the sidebar, switch between them, add new project folders, and browse the active project's file tree,
so that I can navigate my workspace context and inject relevant file paths into the conversation.

## Acceptance Criteria

1. `list_projects` Tauri command reads `~/.hermes/projects.json` (UTF-8 JSON array of `{id, name, path}` objects). If the file does not exist, returns `Ok(Vec::new())`. If the file exists but contains invalid JSON, returns `Ok(Vec::new())` without surfacing an error. Returns projects in file order (no resorting).

2. `add_project(path: String)` Tauri command: derives `name` as the final path component (basename); generates `id` as a 16-char hex string from `DefaultHasher` on the path (`format!("{:016x}", hasher.finish())`); if a project with the same `path` already exists, returns `Ok(())` without duplicating; otherwise appends the new `Project` to the array and writes back to `~/.hermes/projects.json`, creating `~/.hermes/` if absent.

3. `read_dir(path: String)` Tauri command: performs a single-level `std::fs::read_dir`. Returns entries sorted (directories first alphabetically, then files alphabetically). Filters out any entry whose name starts with `.` **or** equals `node_modules`, `__pycache__`, or `target`. If `path` does not exist, is not a directory, or is unreadable, returns `Ok(Vec::new())` without error.

4. `useProjects` hook replaces its stub. Calls `invoke('list_projects')` on mount. Exposes `{ projects, addProject, refresh }`. `addProject(path)` calls `invoke('add_project', { path })` then calls `refresh()`. Errors are caught and logged to console, never thrown.

5. `useFileTree(rootPath)` hook replaces its stub. Accepts `rootPath: string | ""`. When `rootPath` changes to a non-empty value, clears all cache/loading/expanded state then immediately fetches the root level via `invoke('read_dir', { path: rootPath })`. When `rootPath` is empty, returns empty state with no fetches. Exposes `{ childrenOf, toggleExpanded, isExpanded, isLoading }`:
   - `childrenOf(path)` → `DirEntry[]` from cache, or `[]` if not yet loaded.
   - `toggleExpanded(path)` → adds to expanded set and fetches children if not already cached; removes from set on second call.
   - `isExpanded(path)` → `boolean`.
   - `isLoading(path)` → `boolean`.

6. `sidebar.jsx` is replaced with a real implementation containing two sections:
   - **Projects section** (top): Shows active project name (basename of `activeProjectPath`) and path truncated to the last 30 chars (prefix with `…`). Renders a dropdown listing all saved projects; each row shows `project.name` + truncated path (30 chars). Clicking a row activates that project. A **"＋ New Project"** button at the top of the dropdown calls `open({ directory: true })` from `@tauri-apps/plugin-dialog`; on non-null result, calls `addProject(path)` then activates the new path. If no projects exist and no active project, shows "No projects saved." placeholder.
   - **File Tree section** (below, flex-1 overflow-y-auto): Renders the lazy-loaded file tree for `activeProjectPath`. Each directory node shows a `▶`/`▼` chevron and toggles expand on click. Each file node is non-expandable. Entry names are shown in `text-sm text-text`. Depth is communicated via left `paddingLeft = (depth * 12 + 12)px`. A loading indicator (`…` in `text-muted`) appears next to a dir while its children are being fetched. Right-clicking any node shows a 2-item context menu: **"Copy path"** (calls `navigator.clipboard.writeText(entry.path)`) and **"Add to context"** (calls `onAddToContext(entry.path)` prop). If `activeProjectPath` is empty, shows "No project selected." in the tree area.

7. Switching the active project (dropdown row click or new project added): (a) calls `saveConfig({ ...config, active_project: path })` via `useAppConfig`; (b) the file tree resets automatically because `useFileTree(activeProjectPath)` is re-run with the new path.

8. `app.jsx` adds `pendingContextPath` state (`string | null`, default `null`). Passes `onAddToContext={(path) => setPendingContextPath(path)}` to `<Sidebar>`. Passes `pendingContextPath` as prop to `<Composer>`. The existing `Composer` stub does not consume this prop — full injection is deferred to the Composer story. This AC is solely about wiring the plumbing.

## Tasks / Subtasks

- [x] Implement `projects.rs` — real `list_projects` and `add_project` (AC: #1, #2)
  - [x] Add `use std::collections::hash_map::DefaultHasher; use std::hash::{Hash, Hasher};` imports
  - [x] Add `hermes_dir()` helper returning `~/.hermes` as `PathBuf` via `std::env::var("HOME")`
  - [x] Implement `load_projects()` private fn: reads `~/.hermes/projects.json`, deserializes JSON, returns `Vec<Project>` or empty on any error
  - [x] Implement `path_id(path: &str) -> String` using `DefaultHasher`: `format!("{:016x}", hasher.finish())`
  - [x] Replace `list_projects` body: return `Ok(load_projects())`
  - [x] Replace `add_project` body: deduplicate by path, derive basename as `name`, call `path_id` for `id`, append, serialize with `serde_json::to_string_pretty`, write to `~/.hermes/projects.json`
- [x] Implement `fs.rs` — real `read_dir` (AC: #3)
  - [x] Add `const FILTERED: &[&str] = &["node_modules", "__pycache__", "target"];` constant
  - [x] Replace `read_dir` body: return `Ok(Vec::new())` if path is not a directory
  - [x] Collect `DirEntry` vec from `std::fs::read_dir`, filter by name rules, sort dirs-first then alpha
- [x] Implement `useProjects.js` (AC: #4)
  - [x] Replace stub with `useState([])`, `useEffect` calling `refresh()` on mount, `useCallback` for `refresh` (invoke + setState)
  - [x] Add `addProject(path)` callback: `invoke('add_project', { path })` then `refresh()`
  - [x] Errors caught and console.error'd, not thrown
- [x] Implement `useFileTree.js` (AC: #5)
  - [x] Change signature to `export function useFileTree(rootPath)`
  - [x] Add `cache`, `loading`, `expanded` state (object, object, Set)
  - [x] `fetchChildren(path)` useCallback with no deps — uses functional state setters only
  - [x] `useEffect` on `rootPath`: clears state, calls `fetchChildren(rootPath)` if non-empty
  - [x] `toggleExpanded(path)`: adds/removes from Set, calls `fetchChildren(path)` on first expansion
  - [x] Expose `{ childrenOf, toggleExpanded, isExpanded, isLoading }`
- [x] Implement `sidebar.jsx` (AC: #6, #7)
  - [x] Import `open` from `@tauri-apps/plugin-dialog`, `useProjects`, `useFileTree`, `useAppConfig`
  - [x] Add local state: `projectDropdownOpen` (boolean)
  - [x] Render Projects section with dropdown (open/close toggle, overlay div for click-outside)
  - [x] Handle "New Project" flow: call `open({ directory: true })`, guard `null` return, call `addProject`, activate
  - [x] Pass `onAddToContext` prop through to `FileTreeNode` context menu handler
  - [x] Add `FileTreeNode` recursive component (or inner function) within file
  - [x] Right-click context menu: fixed-position dropdown, overlay div for click-outside, two action buttons
- [x] Wire `app.jsx` (AC: #8)
  - [x] Add `const [pendingContextPath, setPendingContextPath] = useState(null);`
  - [x] Pass `onAddToContext={(path) => setPendingContextPath(path)}` to `<Sidebar>`
  - [x] Pass `pendingContextPath={pendingContextPath}` to `<Composer>`

## Dev Notes

### Stub Locations to Replace

| File | Current stub | Required change |
|------|-------------|-----------------|
| `src-tauri/src/projects.rs` | `list_projects` → `Ok(Vec::new())`; `add_project` → `Ok(())` | Real read/write of `~/.hermes/projects.json` |
| `src-tauri/src/fs.rs` | `read_dir` → `Ok(Vec::new())` | Real `std::fs::read_dir` with filter + sort |
| `src/hooks/useProjects.js` | Returns `{ projects: [], addProject: async () => {} }` | Real hook invoking Tauri commands |
| `src/hooks/useFileTree.js` | Returns `{ entries: [], refresh: async () => [] }` | Rewritten with rootPath param + lazy expand |
| `src/components/sidebar.jsx` | Static placeholder | Full project switcher + file tree UI |

### No New Dependencies Required

- `@tauri-apps/plugin-dialog` — already installed and registered in `main.rs` (`tauri_plugin_dialog::init()`)
- `serde_json` — already in `Cargo.toml` (used by `config.rs`)
- `std::collections::hash_map::DefaultHasher` — stdlib, no new crate needed
- `std::fs` — stdlib

### main.rs — NO Changes Required

All 9 Tauri commands are already registered in `main.rs`: `list_sessions`, `get_session_messages`, `get_config`, `save_config`, `list_projects`, `add_project`, `read_dir`, `spawn_gateway`, `kill_gateway`. Do NOT modify `main.rs`.

### app.jsx — Scope Boundary

The only changes to `app.jsx` are the three listed in AC #8 (add `pendingContextPath` state, wire `onAddToContext` to `<Sidebar>`, pass `pendingContextPath` to `<Composer>`). Do NOT remove the static scaffold messages array or ToolCallCard stub — those are tracked as a residual in STORY-0004 and belong to the future Chat story.

### AppConfig.active_project — Type Clarification

`active_project` is a plain `String` field in the Rust `AppConfig` struct (not `Option<String>`), confirmed from STORY-0002 implementation. In JavaScript, `config?.active_project ?? ""` guards against the `config` object itself being `null` during initial load; once config is loaded, `active_project` is always a string (possibly empty). The empty-string check `activeProjectPath ? ...` correctly handles the "no project set yet" state.

### sidebar.jsx — Sessions Section Removal Is Intentional

The current `sidebar.jsx` scaffold renders a static "Sessions" section. This story's replacement intentionally removes it — session switching moved to the header `<SessionSwitcher>` component in STORY-0004. No session-related code belongs in the new Sidebar.

### projects.rs — Full Replacement

```rust
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
}

fn hermes_dir() -> Result<PathBuf, String> {
    std::env::var("HOME")
        .map(|home| PathBuf::from(home).join(".hermes"))
        .map_err(|e| e.to_string())
}

fn load_projects() -> Vec<Project> {
    let path = match hermes_dir() {
        Ok(d) => d.join("projects.json"),
        Err(_) => return Vec::new(),
    };
    if !path.exists() {
        return Vec::new();
    }
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str::<Vec<Project>>(&s).ok())
        .unwrap_or_default()
}

fn path_id(path: &str) -> String {
    let mut h = DefaultHasher::new();
    path.hash(&mut h);
    format!("{:016x}", h.finish())
}

#[tauri::command]
pub fn list_projects() -> Result<Vec<Project>, String> {
    Ok(load_projects())
}

#[tauri::command]
pub fn add_project(path: String) -> Result<(), String> {
    let mut projects = load_projects();
    if projects.iter().any(|p| p.path == path) {
        return Ok(());
    }
    let name = std::path::Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    projects.push(Project { id: path_id(&path), name, path });
    let dir = hermes_dir()?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&projects).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("projects.json"), json).map_err(|e| e.to_string())
}
```

### fs.rs — Full Replacement

```rust
use serde::Serialize;

#[derive(Debug, Clone, Serialize, Default)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

const FILTERED: &[&str] = &["node_modules", "__pycache__", "target"];

#[tauri::command]
pub fn read_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let dir = std::path::Path::new(&path);
    if !dir.is_dir() {
        return Ok(Vec::new());
    }
    let read = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
    let mut entries: Vec<DirEntry> = read
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || FILTERED.contains(&name.as_str()) {
                return None;
            }
            let is_dir = e.file_type().ok()?.is_dir();
            Some(DirEntry {
                path: e.path().to_string_lossy().to_string(),
                name,
                is_dir,
            })
        })
        .collect();
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });
    Ok(entries)
}
```

### useProjects.js — Full Replacement

```js
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useProjects() {
  const [projects, setProjects] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const result = await invoke("list_projects");
      setProjects(result);
    } catch (err) {
      console.error("list_projects failed:", err);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addProject = useCallback(
    async (path) => {
      try {
        await invoke("add_project", { path });
        await refresh();
      } catch (err) {
        console.error("add_project failed:", err);
      }
    },
    [refresh]
  );

  return { projects, addProject, refresh };
}
```

### useFileTree.js — Full Replacement

```js
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useFileTree(rootPath) {
  const [cache, setCache] = useState({});
  const [loading, setLoading] = useState({});
  const [expanded, setExpanded] = useState(new Set());

  const fetchChildren = useCallback(async (path) => {
    setLoading((prev) => (prev[path] ? prev : { ...prev, [path]: true }));
    try {
      const entries = await invoke("read_dir", { path });
      setCache((prev) => ({ ...prev, [path]: entries }));
    } catch (err) {
      console.error("read_dir failed:", err);
      setCache((prev) => ({ ...prev, [path]: [] }));
    } finally {
      setLoading((prev) => ({ ...prev, [path]: false }));
    }
  }, []);

  useEffect(() => {
    setCache({});
    setLoading({});
    setExpanded(new Set());
    if (rootPath) void fetchChildren(rootPath);
  }, [rootPath, fetchChildren]);

  const toggleExpanded = useCallback(
    (path) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          void fetchChildren(path);
        }
        return next;
      });
    },
    [fetchChildren]
  );

  const childrenOf = useCallback((path) => cache[path] ?? [], [cache]);
  const isExpanded = useCallback((path) => expanded.has(path), [expanded]);
  const isLoading = useCallback((path) => Boolean(loading[path]), [loading]);

  return { childrenOf, toggleExpanded, isExpanded, isLoading };
}
```

**Important:** The hook signature changes from `useFileTree()` to `useFileTree(rootPath)`. The Sidebar will call it as `useFileTree(activeProjectPath)`. No other consumers currently call this hook.

### sidebar.jsx — Full Replacement

```jsx
import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjects } from "../hooks/useProjects";
import { useFileTree } from "../hooks/useFileTree";
import { useAppConfig } from "../hooks/useAppConfig";

function truncatePath(str, n = 30) {
  if (!str) return "";
  return str.length <= n ? str : "…" + str.slice(-(n - 1));
}

function FileTreeNode({ entry, depth, childrenOf, toggleExpanded, isExpanded, isLoading, onAddToContext }) {
  const [ctxMenu, setCtxMenu] = useState(null);
  const expanded = isExpanded(entry.path);
  const children = childrenOf(entry.path);
  const loading = isLoading(entry.path);

  return (
    <div>
      <div
        className="flex cursor-default items-center gap-1.5 rounded-md px-2 py-0.5 text-sm text-text hover:bg-panel/60 select-none"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => entry.is_dir && toggleExpanded(entry.path)}
        onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
      >
        {entry.is_dir ? (
          <span className="w-3 shrink-0 font-mono text-[10px] text-muted">
            {expanded ? "▼" : "▶"}
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="truncate">{entry.name}</span>
        {loading && <span className="ml-auto text-[10px] text-muted">…</span>}
      </div>

      {entry.is_dir && expanded &&
        children.map((child) => (
          <FileTreeNode
            key={child.path}
            entry={child}
            depth={depth + 1}
            childrenOf={childrenOf}
            toggleExpanded={toggleExpanded}
            isExpanded={isExpanded}
            isLoading={isLoading}
            onAddToContext={onAddToContext}
          />
        ))}

      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setCtxMenu(null)} />
          <div
            className="fixed z-20 min-w-[140px] overflow-hidden rounded-lg border border-border bg-sidebar shadow-lg"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            <button
              type="button"
              onClick={() => { void navigator.clipboard.writeText(entry.path); setCtxMenu(null); }}
              className="flex w-full items-center px-3 py-2 text-sm text-text hover:bg-panel/60"
            >
              Copy path
            </button>
            <button
              type="button"
              onClick={() => { onAddToContext(entry.path); setCtxMenu(null); }}
              className="flex w-full items-center px-3 py-2 text-sm text-text hover:bg-panel/60"
            >
              Add to context
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Sidebar({ onAddToContext }) {
  const { config, saveConfig } = useAppConfig();
  const { projects, addProject } = useProjects();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeProjectPath = config?.active_project ?? "";
  const activeProject = projects.find((p) => p.path === activeProjectPath);
  const { childrenOf, toggleExpanded, isExpanded, isLoading } = useFileTree(activeProjectPath);

  async function activateProject(path) {
    if (!config) return;
    await saveConfig({ ...config, active_project: path });
    setDropdownOpen(false);
  }

  async function handleNewProject() {
    const path = await open({ directory: true, multiple: false });
    if (!path) return;
    await addProject(path);
    await activateProject(path);
  }

  const rootEntries = childrenOf(activeProjectPath);

  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Projects section */}
      <div className="relative border-b border-border px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted mb-1">
          Project
        </p>
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium text-text hover:bg-panel/60 transition"
        >
          <span className="truncate">
            {activeProject?.name ?? (activeProjectPath ? activeProjectPath.split("/").pop() : "No project")}
          </span>
          <span className="ml-2 shrink-0 font-mono text-[10px] text-muted">▾</span>
        </button>
        {activeProjectPath && (
          <p className="mt-0.5 px-2 font-mono text-[10px] text-muted truncate">
            {truncatePath(activeProjectPath)}
          </p>
        )}

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
            <div className="absolute left-2 right-2 top-full z-20 mt-1 rounded-xl border border-border bg-sidebar shadow-lg overflow-hidden">
              <button
                type="button"
                onClick={handleNewProject}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-accent hover:bg-panel/60 transition"
              >
                ＋ New Project
              </button>
              <div className="h-px bg-border" />
              {projects.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted">No projects saved.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  {projects.map((proj) => (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => activateProject(proj.path)}
                      className={`flex w-full flex-col px-4 py-2 text-left text-sm hover:bg-panel/60 transition ${
                        proj.path === activeProjectPath ? "text-accent" : "text-text"
                      }`}
                    >
                      <span className="font-medium truncate">{proj.name}</span>
                      <span className="font-mono text-[10px] text-muted truncate">
                        {truncatePath(proj.path)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* File tree section */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <p className="px-4 pt-3 pb-1 font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
          Files
        </p>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {!activeProjectPath ? (
            <p className="px-2 py-2 text-xs text-muted">No project selected.</p>
          ) : rootEntries.length === 0 && isLoading(activeProjectPath) ? (
            <p className="px-2 py-2 text-xs text-muted">Loading…</p>
          ) : rootEntries.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted">Empty directory.</p>
          ) : (
            rootEntries.map((entry) => (
              <FileTreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                childrenOf={childrenOf}
                toggleExpanded={toggleExpanded}
                isExpanded={isExpanded}
                isLoading={isLoading}
                onAddToContext={onAddToContext}
              />
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
```

### app.jsx Changes (diff-style)

```jsx
// Add import:
// (no new imports needed — Sidebar already imported)

// Add inside App() function, alongside existing state:
const [pendingContextPath, setPendingContextPath] = useState(null);

// Change Sidebar usage from:
<Sidebar />
// To:
<Sidebar onAddToContext={(path) => setPendingContextPath(path)} />

// Change Composer usage from:
<Composer />
// To:
<Composer pendingContextPath={pendingContextPath} />
```

No other changes to `app.jsx`.

### Architecture Compliance

- **`list_projects` / `add_project`**: architecture §4.1 documents these commands; `~/.hermes/projects.json` is the canonical path from architecture §4.1
- **`read_dir`**: architecture §4.1 documents this command; used by `useFileTree` per §4.2
- **`useProjects()` / `useFileTree(path)` hooks**: architecture §4.2 defines these hook signatures
- **`Sidebar` component tree**: architecture §4.2 shows `Sidebar > FileTree (useFileTree)` — no sub-components listed, single-file implementation is acceptable
- **Dialog plugin**: `@tauri-apps/plugin-dialog` version 2.x; already in `main.rs` — no Cargo.toml change required
- **PRD P3**: "New Project" action opens folder picker — satisfied by `open({ directory: true })`
- **PRD P4**: "Switching project updates file tree" — satisfied by `useFileTree(activeProjectPath)` reacting to path change; gateway context injection (AGENTS.md) is deferred (no explicit RPC method defined in architecture §2.2 for project context)
- **PRD F2**: `.git`, `.venv` covered by `name.starts_with('.')` filter; `node_modules`, `__pycache__` by explicit list; `target` added as Rust workspace noise
- **PRD F6**: `read_dir` returns no write operations; sidebar renders tree read-only

### Design Tokens

```
bg-sidebar       sidebar background (#161618) — use for dropdown panel bg
bg-panel/60      hover state for rows
text-accent      Nous Purple (#7C3AED) — active project, "New Project" button, active row
text-muted       truncated paths, chevrons, font-mono detail text
border-border    dividers, dropdown border
font-mono        path text and tree label counters use JetBrains Mono
w-sidebar        260px fixed (CSS var --sidebar-width)
```

### What Is Out of Scope for This Story

- Gateway AGENTS.md injection on project switch (PRD P4 partial) — no `project.set` RPC in Hermes TUI Gateway protocol; deferred
- F5 (active file highlighted in tree from tool calls) — P2, deferred
- Chat message streaming — future story
- Composer slash command palette — future story
- Full "Add to context" composer injection UI (Composer story will read `pendingContextPath` and insert `@<path>` into textarea)

### Previous Story Context

- `useAppConfig` pattern (STORY-0002): module-level shared state with `listeners` — `saveConfig` is already implemented and emits to all subscribers; calling it in Sidebar to update `active_project` is correct
- `sidebar.jsx` is currently imported in `app.jsx` with no props; after this story it requires `onAddToContext` prop — must update `app.jsx` call site
- STORY-0004 noted: "Do NOT create a `TitleBar` component — that belongs to the story that adds `ProjectSwitcher`" — this story adds project switching but not a separate `TitleBar`; the sidebar handles it internally
- `useFileTree.js` and `useProjects.js` are currently imported nowhere except their stub file — only `sidebar.jsx` will consume them after this story

### References

- Project commands: [Source: docs/architecture.md#4.1-tauri-backend-rust]
- `useFileTree`, `useProjects` hooks: [Source: docs/architecture.md#4.2-react-frontend]
- `~/.hermes/projects.json` path: [Source: docs/architecture.md#4.1-tauri-backend-rust]
- PRD sidebar requirements: [Source: docs/prd.md#6.3-sidebar--project-switcher] (P1-P4)
- PRD file tree requirements: [Source: docs/prd.md#6.4-sidebar--file-tree] (F1-F4, F6)
- Design tokens: [Source: hermes-desktop/src/styles/globals.css]
- Tech stack: [Source: docs/architecture.md#5-tech-stack]
- Tauri plugin-dialog already registered: [Source: hermes-desktop/src-tauri/src/main.rs]

## PO Alignment

2026-06-08 PO APPROVED: All 8 ACs are numbered, specific, and testable with exact algorithmic contracts (DefaultHasher 16-char hex ID, dirs-first alpha sort, named filter list). Story maps cleanly to PRD §6.3 P1-P4 and §6.4 F1-F4/F6; gateway-context injection (P4 partial) correctly deferred with rationale. Architecture compliance documented for every command, hook, and file path per §4.1/§4.2/§7. Dependencies verified: STORY-0002 (useAppConfig) and STORY-0004 (session header) are COMPLETE; plugin-dialog, serde_json, and all 9 main.rs command registrations confirmed present. Stub files for all 5 replacement targets exist. No scope overlap with completed stories.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `git log --oneline -20`
- `npm run build`
- `cargo fmt --all --check`
- `cargo build --release`
- `cargo test --release`

### Completion Notes List

- Replaced the project and directory command stubs with real Rust implementations for `~/.hermes/projects.json` persistence and single-level filtered directory reads, preserving the story’s error-tolerant empty-list behavior.
- Replaced the stub hooks with `useProjects()` and `useFileTree(rootPath)`, including lazy tree loading, expansion state, cache reset on active-project changes, and console-only error handling.
- Rebuilt the sidebar as a working project switcher plus file tree, including folder-picker project creation, config-backed active-project switching, and a right-click menu for copying paths or sending them into app state as pending composer context.
- Wired `pendingContextPath` through `app.jsx` to preserve the deferred Composer integration boundary from the story notes.

## Implementation Notes

### Files Changed

- `hermes-desktop/src-tauri/src/projects.rs`
- `hermes-desktop/src-tauri/src/fs.rs`
- `hermes-desktop/src/hooks/useProjects.js`
- `hermes-desktop/src/hooks/useFileTree.js`
- `hermes-desktop/src/components/sidebar.jsx`
- `hermes-desktop/src/app.jsx`
- `docs/backlog/stories/story-0005-sidebar-project-switcher-file-tree.md`

### Approach

- Kept project persistence and directory enumeration in Rust Tauri commands so the frontend only coordinates UI state and command invocation, matching the thin-shell architecture used in prior stories.
- Implemented `useFileTree(rootPath)` around explicit cache/loading/expanded maps plus a generation guard so switching projects clears stale tree state immediately and ignores late responses from the previous root.
- Contained project activation in the sidebar by reusing `useAppConfig().saveConfig`, which keeps the active project consistent for every existing config consumer without introducing a new global store.

### Key Decisions

- `read_dir` returns `Ok(Vec::new())` on unreadable directories as well as non-directories, because the acceptance criteria require silent empty results rather than surfaced Rust errors for filesystem edge cases.
- The sidebar renders the active project from config even if that path is not yet present in `projects.json`, which preserves manual settings edits from STORY-0002 while still offering the saved-project dropdown for switching.
- Reused the temporary `/tmp/hermes-sysroot` verification path from earlier stories to complete `cargo build --release` and `cargo test --release` on this host without committing any environment-specific build hacks.

### File List

- `docs/backlog/stories/story-0005-sidebar-project-switcher-file-tree.md`
- `hermes-desktop/src-tauri/src/projects.rs`
- `hermes-desktop/src-tauri/src/fs.rs`
- `hermes-desktop/src/hooks/useProjects.js`
- `hermes-desktop/src/hooks/useFileTree.js`
- `hermes-desktop/src/components/sidebar.jsx`
- `hermes-desktop/src/app.jsx`

## QA Notes

**QA Status:** PASS  
**QA Date:** 2026-06-08  
**Reviewer:** Automated QA pipeline (Claude Sonnet 4.6)

### What Was Tested

**Build verification:**
- `npm run build` — passed (Vite 5, 1799 modules, no warnings)
- `cargo fmt --all --check` — passed (clean formatting)
- `cargo build --release` — passed (with `/tmp/hermes-sysroot` env, same as prior stories)
- `cargo test --release` — passed (0 tests, consistent with project baseline)

**AC-by-AC verification (all 8 pass):**

1. **AC1 — `list_projects`**: `load_projects()` reads `~/.hermes/projects.json` via `hermes_dir()`, returns `Vec::new()` on missing file (explicit `path.exists()` check), returns `Vec::new()` on invalid JSON (`.unwrap_or_default()`). File order preserved (no sort applied). ✓
2. **AC2 — `add_project`**: Basename derived via `Path::new(&path).file_name()`, ID is `format!("{:016x}", hasher.finish())` (DefaultHasher, 16 hex chars), deduplication guard on `p.path == path`, `create_dir_all` creates `~/.hermes/` on first write, writes `serde_json::to_string_pretty`. ✓
3. **AC3 — `read_dir`**: Returns `Ok(Vec::new())` when `!dir.is_dir()` (handles nonexistent + non-directory), returns `Ok(Vec::new())` on `read_dir` failure (explicit `Err(_) => return Ok(Vec::new())`). Filters `name.starts_with('.')` and `FILTERED = ["node_modules", "__pycache__", "target"]`. Sort: dirs-first then alphabetical by name. ✓
4. **AC4 — `useProjects`**: `refresh` called in `useEffect` on mount, `addProject` calls `invoke('add_project', { path })` then `refresh()`, all errors caught with `console.error` and not rethrown. Exposes `{ projects, addProject, refresh }`. ✓
5. **AC5 — `useFileTree`**: Accepts `rootPath: string`. `useEffect` on rootPath change clears `cache`, `loading`, `expanded` (including refs) then calls `fetchChildren(rootPath)` if non-empty. Empty string → no fetch, empty state. `toggleExpanded` adds/removes from Set and conditionally fetches if not cached. All four functions exposed correctly. Generation guard prevents stale root-change results from polluting state. ✓
6. **AC6 — `sidebar.jsx`**: Projects section shows `basename(activeProjectPath)` as name, `truncateTail(path, 30)` for path (last 30 chars prefixed with `…`). Dropdown lists all projects with name + truncated path; clicking activates. "＋ New Project" calls `open({ directory: true })`, null-guards the return, calls `addProject` + `activateProject`. "No projects saved." placeholder when `!activeProjectPath && projects.length === 0`. File tree section uses `flex-1 overflow-y-auto` layout. Chevron `▶`/`▼` toggles on dir click. Files non-clickable (guard `entry.is_dir && toggleExpanded`). `paddingLeft: depth * 12 + 12 px`. Loading `…` shown on dir nodes. Right-click context menu at cursor position with overlay backdrop; "Copy path" calls `navigator.clipboard.writeText`, "Add to context" calls `onAddToContext?.(path)`. "No project selected." when empty. ✓
7. **AC7 — Project switching**: `activateProject` calls `saveConfig({ ...config, active_project: path })`, closes dropdown. File tree resets automatically because `useFileTree(activeProjectPath)` re-executes with new path (its `useEffect` on rootPath clears all state). ✓
8. **AC8 — `app.jsx` wiring**: `const [pendingContextPath, setPendingContextPath] = useState(null)` added. `<Sidebar onAddToContext={(path) => setPendingContextPath(path)} />` wired. `<Composer pendingContextPath={pendingContextPath} />` wired. Static scaffold messages array and ToolCallCard stub preserved per story notes. ✓

**Regression checks (prior stories):**
- main.rs unmodified — all 9 commands still registered ✓
- `useAppConfig` pattern unchanged (STORY-0002) ✓
- `useHermesGateway` + `StatusBar` unchanged (STORY-0003) ✓
- `useSessions` + `SessionSwitcher` unchanged (STORY-0004) ✓
- Sidebar no longer renders Sessions section (intentional per STORY-0004 migration) ✓

**Code quality observations:**
- `useFileTree.js` uses a `return` inside the `finally` block to suppress stale-generation state updates — unusual but functionally correct; return value of `fetchChildren` is always discarded with `void`.
- `open({ directory: true })` omits `multiple: false` (Tauri dialog defaults to single-selection); functionally equivalent to the reference implementation.
- `truncateTail` shows `…` + last 30 chars; reference `truncatePath` used `n - 1 = 29` chars + `…`. The implementation matches the AC literal ("last 30 chars") and the difference is cosmetic (1 char).
- Root-level loading state not shown with a placeholder (blank area while root fetches); AC6 only requires a loading indicator per-dir node, not a root spinner. Not a failure.

**Pass confidence:** High. All 8 ACs verified against actual code; builds clean; no regressions detected.
