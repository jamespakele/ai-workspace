---
story_id: "STORY-0004"
title: "Session Switcher & SQLite Session Reads"
status: "PENDING_QA"
po_alignment: "APPROVED"
created_at: "2026-06-08"
updated_at: "2026-06-08"
---

# Story 4.1: Session Switcher & SQLite Session Reads

Status: pending-qa

## Story

As a developer using Hermes Desktop,
I want to see my recent Hermes sessions in a dropdown in the app header, select any to resume it, and start a new session,
so that I can switch between ongoing conversations without closing and reopening the app.

## Acceptance Criteria

1. `list_sessions` Tauri command reads `~/.hermes/state.db` with `read_only(true)` via sqlx 0.7, returning up to 50 sessions ordered by `started_at DESC` using the exact query from architecture §3.2. If the `.db` file does not exist, the command returns an empty `Vec` with no error.
2. `useSessions` hook calls `invoke('list_sessions')` on mount and exposes `{ sessions, activeSessionId, setActiveSessionId, refresh }`. `sessions` matches the `SessionSummary` shape from `sessions.rs`; `activeSessionId` is `string | null`, initialized to `null`.
3. A `SessionSwitcher` dropdown component is rendered in the app `<header>` (replacing the current static title text). The trigger label shows the active session's title (or first 63 chars of preview if title is empty/null), falling back to `"New Session"` when `activeSessionId` is `null`.
4. The dropdown lists all sessions from `useSessions`. Each row shows: title or preview (truncated to 50 chars), date formatted as `"Today"` / `"Yesterday"` / `"MMM D"`, and `total_tokens` formatted with `.toLocaleString()`.
5. Clicking a session row: (a) sends `{ method: "session.resume", params: { session_id } }` via `send`; (b) calls `setActiveSessionId(session_id)`; (c) calls `resetTokenCount()` to zero the status bar counter.
6. A `"+ New Session"` item pinned at the top of the dropdown sends `{ method: "session.create", params: {} }` via `send`, calls `setActiveSessionId(null)`, and calls `resetTokenCount()`.
7. `useHermesGateway` exposes a `resetTokenCount` function (in addition to its existing return shape) that sets `tokenCount` back to `0`. No other behavior changes in the hook.
8. The status bar `session:` label renders `activeSessionId.slice(0, 8) + "…"` when non-null, or `"—"` when null. The hardcoded `"scaffold"` string must be removed.
9. The SQLite connection opens with `SqliteConnectOptions::new().filename(db_path).read_only(true)` — no writes, no WAL interference.

## Tasks / Subtasks

- [x] Add sqlx dependency to Cargo.toml (AC: #1, #9)
  - [x] Add `sqlx = { version = "0.7", features = ["sqlite", "runtime-tokio"] }` to `[dependencies]` in `src-tauri/Cargo.toml`
- [x] Implement real `list_sessions` in `sessions.rs` (AC: #1, #9)
  - [x] Add `use sqlx::sqlite::SqliteConnectOptions;` and `use sqlx::SqlitePool;` imports
  - [x] Resolve `~/.hermes/state.db` path with `dirs::home_dir()` — or use `std::env::var("HOME")` as fallback; add `dirs = "5"` to Cargo.toml if needed
  - [x] Open pool with `SqlitePool::connect_with(options).await`; if file does not exist, return `Ok(vec![])` before opening
  - [x] Execute the SQL from architecture §3.2 with `sqlx::query(SESSION_LIST_SQL).fetch_all(&pool).await`; map rows manually via `row.try_get()` into `SessionSummary` — no intermediate `SessionRow` type needed
  - [x] Change `total_tokens` field in `SessionSummary` from `u64` to `i64` (sqlx returns SQLite INTEGER as `i64`; leaving it `u64` causes a runtime type error)
  - [x] Change command signature to `pub async fn list_sessions() -> Result<Vec<SessionSummary>, String>`
  - [x] `get_session_messages` remains a stub returning `Ok(vec![])` — do not implement it in this story
- [x] Implement real `useSessions` hook (AC: #2)
  - [x] Replace stub body with `useState` for `sessions` (default `[]`) and `activeSessionId` (default `null`)
  - [x] On mount, call `invoke('list_sessions')` and set `sessions`; handle errors silently (log, don't throw)
  - [x] Expose `refresh` as a function that re-calls `invoke('list_sessions')` and updates state
  - [x] Export `{ sessions, activeSessionId, setActiveSessionId, refresh }`
- [x] Add `resetTokenCount` to `useHermesGateway` (AC: #7)
  - [x] Add `const resetTokenCount = useCallback(() => setTokenCount(0), [])` inside the hook
  - [x] Add `resetTokenCount` to the returned object — no other changes to the hook
- [x] Create `session-switcher.jsx` component (AC: #3, #4, #5, #6)
  - [x] Accept props: `sessions`, `activeSessionId`, `setActiveSessionId`, `send`, `resetTokenCount`
  - [x] Use a `<details>`/`<summary>` or `useState` open/close pattern for the dropdown (no Radix needed — keep it simple)
  - [x] Render `"+ New Session"` as the first item in the list
  - [x] Render each session row with truncated title/preview, formatted date, and token count
  - [x] On item click: call `send`, `setActiveSessionId`, `resetTokenCount`, close dropdown
  - [x] Trigger label: resolve active session title from `sessions` array; fall back to `"New Session"`
- [x] Update `statusbar.jsx` (AC: #8)
  - [x] Add `activeSessionId` to the props signature
  - [x] Replace `<span>session: scaffold</span>` with `<span>session: {activeSessionId ? activeSessionId.slice(0, 8) + "…" : "—"}</span>`
- [x] Wire everything in `app.jsx` (AC: #3, #5, #6, #7, #8)
  - [x] Import and call `useSessions()`; destructure `{ sessions, activeSessionId, setActiveSessionId }`
  - [x] Add `resetTokenCount` to destructured return from `useHermesGateway()`
  - [x] **Remove the existing `startGateway` `useEffect`** — `useHermesGateway` already handles `spawn_gateway` internally; leaving both causes a double-spawn on app start
  - [x] Replace the static `<h1>Application Shell</h1>` header content with `<SessionSwitcher>` receiving all required props
  - [x] Pass `activeSessionId` to `<StatusBar>`

## Dev Notes

### Stub Locations to Replace

| File | Current stub | Required change |
|------|-------------|-----------------|
| `src-tauri/src/sessions.rs` | `list_sessions` returns `Ok(Vec::new())` synchronously | Real sqlx async implementation |
| `src/hooks/useSessions.js` | Returns `{ sessions: [], refresh: async () => [] }` | Real hook with invoke + state |
| `src/hooks/useHermesGateway.js` | No `resetTokenCount` in return | Add `resetTokenCount` to return shape |
| `src/components/statusbar.jsx` | Hardcoded `session: scaffold` | Prop-driven `activeSessionId` |
| `src/app.jsx` | Static header with `<h1>Application Shell</h1>` | Render `SessionSwitcher` in header |

### Cargo.toml Changes

```toml
# Add to [dependencies] in src-tauri/Cargo.toml
sqlx = { version = "0.7", features = ["sqlite", "runtime-tokio"] }
dirs = "5"
```

`dirs` provides `dirs::home_dir()` → `Option<PathBuf>`. Tauri 2 already has tokio so the `runtime-tokio` feature will not pull in a duplicate runtime.

### sessions.rs — Full Replacement

```rust
use serde::Serialize;
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::{Row, SqlitePool};

#[derive(Debug, Clone, Serialize, Default)]
pub struct SessionSummary {
    pub id: String,
    pub title: String,
    pub model: String,
    pub started_at: f64,
    pub total_tokens: i64,
    pub preview: String,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct Message {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: f64,
}

const SESSION_LIST_SQL: &str = r#"
SELECT
    s.id,
    s.title,
    s.model,
    s.started_at,
    s.input_tokens + s.output_tokens AS total_tokens,
    COALESCE(
        (SELECT SUBSTR(m.content, 1, 63)
         FROM messages m
         WHERE m.session_id = s.id AND m.role = 'user' AND m.content IS NOT NULL
         ORDER BY m.timestamp, m.id LIMIT 1),
        ''
    ) AS preview
FROM sessions s
WHERE s.source = 'cli'
ORDER BY s.started_at DESC
LIMIT 50
"#;

#[tauri::command]
pub async fn list_sessions() -> Result<Vec<SessionSummary>, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let db_path = home.join(".hermes").join("state.db");

    if !db_path.exists() {
        return Ok(Vec::new());
    }

    let options = SqliteConnectOptions::new()
        .filename(&db_path)
        .read_only(true);

    let pool = SqlitePool::connect_with(options)
        .await
        .map_err(|e| e.to_string())?;

    let rows = sqlx::query(SESSION_LIST_SQL)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string())?;

    pool.close().await;

    let sessions = rows
        .iter()
        .map(|row| SessionSummary {
            id: row.try_get::<String, _>("id").unwrap_or_default(),
            title: row.try_get::<Option<String>, _>("title").unwrap_or(None).unwrap_or_default(),
            model: row.try_get::<Option<String>, _>("model").unwrap_or(None).unwrap_or_default(),
            started_at: row.try_get::<f64, _>("started_at").unwrap_or(0.0),
            total_tokens: row.try_get::<i64, _>("total_tokens").unwrap_or(0),
            preview: row.try_get::<String, _>("preview").unwrap_or_default(),
        })
        .collect();

    Ok(sessions)
}

#[tauri::command]
pub fn get_session_messages(_session_id: String) -> Result<Vec<Message>, String> {
    Ok(Vec::new())
}
```

**Important:** `list_sessions` must be declared `async fn` so Tauri invokes it on the tokio runtime. The `get_session_messages` stub remains synchronous and unchanged.

### useSessions.js — Full Replacement

```js
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useSessions() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const result = await invoke("list_sessions");
      setSessions(result);
    } catch (err) {
      console.error("list_sessions failed:", err);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { sessions, activeSessionId, setActiveSessionId, refresh };
}
```

### useHermesGateway.js — resetTokenCount Addition

Find the existing return statement and add `resetTokenCount`:

```js
// Inside useHermesGateway — add alongside existing state declarations:
const resetTokenCount = useCallback(() => setTokenCount(0), []);

// Add to the return object:
return { status, send, activeModel, tokenCount, resetTokenCount };
```

Do NOT change any other behavior in the hook.

### session-switcher.jsx — New Component

```jsx
import { useState } from "react";

function formatDate(epochSeconds) {
  const d = new Date(epochSeconds * 1000);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function truncate(str, n) {
  return str && str.length > n ? str.slice(0, n) + "…" : (str ?? "");
}

export function SessionSwitcher({
  sessions,
  activeSessionId,
  setActiveSessionId,
  send,
  resetTokenCount,
}) {
  const [open, setOpen] = useState(false);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const triggerLabel = activeSession
    ? truncate(activeSession.title || activeSession.preview, 40) || "Untitled"
    : "New Session";

  function handleSelect(sessionId) {
    send("session.resume", { session_id: sessionId });
    setActiveSessionId(sessionId);
    resetTokenCount();
    setOpen(false);
  }

  function handleNew() {
    send("session.create", {});
    setActiveSessionId(null);
    resetTokenCount();
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-text hover:bg-panel transition"
      >
        <span className="max-w-[240px] truncate">{triggerLabel}</span>
        <span className="text-muted">▾</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-full z-20 mt-1 w-80 rounded-xl border border-border bg-sidebar shadow-lg">
            <button
              type="button"
              onClick={handleNew}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm text-accent hover:bg-panel/60 transition rounded-t-xl"
            >
              + New Session
            </button>
            <div className="h-px bg-border" />
            <div className="max-h-72 overflow-y-auto">
              {sessions.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted">No sessions found.</p>
              )}
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelect(s.id)}
                  className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left text-sm hover:bg-panel/60 transition last:rounded-b-xl ${
                    s.id === activeSessionId ? "bg-panel/40 text-accent" : "text-text"
                  }`}
                >
                  <span className="truncate font-medium">
                    {truncate(s.title || s.preview, 50) || "Untitled"}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {formatDate(s.started_at)} · {s.total_tokens.toLocaleString()} tokens
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

### statusbar.jsx — Prop Change Only

```jsx
// Change props signature:
export function StatusBar({ gatewayStatus, activeModel, tokenCount, activeSessionId, onSettingsOpen }) {

// Change the session span from:
<span>session: scaffold</span>
// To:
<span>session: {activeSessionId ? activeSessionId.slice(0, 8) + "…" : "—"}</span>
```

No other changes to statusbar.jsx.

### app.jsx Integration

**Important:** The current `app.jsx` contains a `startGateway` `useEffect` that also calls `invoke("spawn_gateway")`. This is now redundant — `useHermesGateway` handles auto-start internally. Remove the entire `startGateway` useEffect block before adding the new wiring below.

```jsx
// Add import:
import { SessionSwitcher } from "./components/session-switcher";
import { useSessions } from "./hooks/useSessions";

// Inside App():
const { sessions, activeSessionId, setActiveSessionId } = useSessions();
const { status: gatewayStatus, activeModel, tokenCount, send, resetTokenCount } = useHermesGateway();

// Replace the <header> content:
<header className="flex items-center border-b border-border px-6 py-3">
  <SessionSwitcher
    sessions={sessions}
    activeSessionId={activeSessionId}
    setActiveSessionId={setActiveSessionId}
    send={send}
    resetTokenCount={resetTokenCount}
  />
</header>

// Add activeSessionId to StatusBar:
<StatusBar
  gatewayStatus={gatewayStatus}
  activeModel={activeModel}
  tokenCount={tokenCount}
  activeSessionId={activeSessionId}
  onSettingsOpen={() => setSettingsOpen(true)}
/>
```

Remove the static `messages` array and the temporary `<ToolCard>` scaffold stub from `app.jsx` — they are no longer needed now that the session switcher is the focus.

**Note:** The `<Message>`, `<Markdown>`, `<ToolCard>` imports can remain registered for future stories — do NOT delete them. Just remove the static render calls.

### Architecture Compliance

- **sqlx 0.7 + read-only**: follows architecture §3.3 exactly
- **SQL query**: uses exact query from architecture §3.2 (COALESCE + subquery for preview)
- **`session.resume` / `session.create` RPC**: from architecture §2.2 key RPC methods table
- **`SessionSummary` struct**: already defined in sessions.rs scaffold; only `total_tokens` type changes from `u64` to `i64` to match sqlx row output
- **Component tree**: `SessionSwitcher` is child of header (future `TitleBar` component) per architecture §4.2
- **`useSessions` hook**: matches architecture §4.2 hook spec

### Design Tokens

```css
/* From globals.css — use these classes */
bg-sidebar      /* sidebar background — use for dropdown panel */
bg-panel        /* slightly lighter panel background */
bg-canvas       /* darkest background */
text-accent     /* Nous Purple #7C3AED — use for "New Session" and active row */
text-muted      /* muted text for dates/tokens */
border-border   /* standard border color */
```

`text-accent` is `#7C3AED` (Nous Purple). Use it for the `"+ New Session"` button and the active session row text. Do NOT use it for connection status (that's STORY-0003's colored dots).

### Previous Story Context (STORY-0003)

- `useHermesGateway` currently returns `{ status, send, activeModel, tokenCount }`. Add `resetTokenCount` to this without touching the existing shape.
- `send(method, params)` is already implemented — `send("session.resume", { session_id })` will work as-is once the gateway is connected.
- StatusBar currently uses `tokenCount` from the hook — the `resetTokenCount` addition lets SessionSwitcher zero it on session switch.
- `sessions.rs` `get_session_messages` stub: keep as-is. It is registered in `main.rs` and used in future stories.

### No New Frontend Dependencies

All dropdown behavior uses `useState` open/close with a fixed overlay `<div>` — no Radix, no Headless UI. The design system already provides all needed utility classes.

### Project Structure Notes

- New file: `hermes-desktop/src/components/session-switcher.jsx`
- Modified: `hermes-desktop/src-tauri/Cargo.toml`, `sessions.rs`, `useSessions.js`, `useHermesGateway.js`, `statusbar.jsx`, `app.jsx`
- Do NOT create a `TitleBar` component — that belongs to the story that adds `ProjectSwitcher` (future STORY-0005 or similar)
- Do NOT modify `sidebar.jsx` — sidebar sessions section is a stub, left for the Sidebar story

### What Is Out of Scope for This Story

- Chat message streaming (`prompt.submit`, `message.delta`, `message.complete` rendering) — future story
- `get_session_messages` implementation and loading session history into the chat view — future story
- ProjectSwitcher and file tree — future story
- Model switcher dropdown (B3-B4) — Phase 2
- Session branching/compression commands — Phase 2

### References

- Session list query: [Source: docs/architecture.md#3.2-session-list-query-nav-bar-dropdown]
- SQLite read-only pattern: [Source: docs/architecture.md#3.3-write-contention]
- RPC methods: [Source: docs/architecture.md#2.2-key-rpc-methods]
- Session list requirements: [Source: docs/prd.md#6.5-navigation-bar--session-switcher] (S1-S5)
- `sessions.rs` stub: [Source: hermes-desktop/src-tauri/src/sessions.rs]
- `useSessions.js` stub: [Source: hermes-desktop/src/hooks/useSessions.js]
- Design tokens: [Source: hermes-desktop/src/styles/globals.css]
- Tech stack: [Source: docs/architecture.md#5-tech-stack]

## PO Alignment

2026-06-08 PO APPROVED: All criteria met. ACs #1-#9 map 1:1 to PRD §6.5 (S1-S5) and §6.6 (B2). Architecture compliance verified: sqlx 0.7 read-only (§3.3), exact SQL from §3.2, RPC methods from §2.2, component placement matches §4.2 tree. Full code replacements provided in Dev Notes eliminate ambiguity. Scope is right-sized (1 new file, 5 modified). All prior dependencies (STORY-0001/0002/0003) are COMPLETED. No duplicate scope with existing stories.

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

- Replaced the stubbed Rust session command with a real read-only `sqlx` SQLite query against `~/.hermes/state.db`, preserving the exact architecture query and returning an empty list when the DB is absent.
- Replaced the frontend session stub with `useSessions()`, added `resetTokenCount` to the gateway hook, and introduced a header `SessionSwitcher` that can resume sessions or start a new one while resetting the status-bar token counter.
- Wired the active session ID through the app and status bar, and removed the duplicate gateway-start effect from `app.jsx` so the app no longer tries to spawn Hermes twice on launch.
- Cleared two pre-existing `src-tauri/src/main.rs` compile issues that only surfaced once the temporary native sysroot allowed a full Rust build on this host.

## Implementation Notes

### Files Changed

- `hermes-desktop/src-tauri/Cargo.toml`
- `hermes-desktop/src-tauri/src/sessions.rs`
- `hermes-desktop/src-tauri/src/main.rs`
- `hermes-desktop/src/hooks/useSessions.js`
- `hermes-desktop/src/hooks/useHermesGateway.js`
- `hermes-desktop/src/components/session-switcher.jsx`
- `hermes-desktop/src/components/statusbar.jsx`
- `hermes-desktop/src/app.jsx`
- `docs/backlog/stories/story-0004-session-switcher.md`

### Approach

- Kept the session list source in Rust so the header dropdown works even when the gateway is offline, using `sqlx` with `SqliteConnectOptions::read_only(true)` to avoid WAL/write contention with Hermes.
- Implemented session selection entirely in the existing app shell by introducing a focused `SessionSwitcher` component and keeping state ownership in `useSessions()` plus the existing gateway hook.
- Preserved the story boundary by leaving chat history loading stubbed while still wiring the session ID and token-reset behavior needed by the status bar and header UX.

### Key Decisions

- `SessionSummary.total_tokens` was changed to `i64` to match SQLite integer decoding from `sqlx` and avoid the runtime type mismatch the story warned about.
- The session trigger label prefers the active session title, falls back to preview text, and uses `"New Session"` only when there is no active session, matching the acceptance criteria without inventing extra session state.
- Reused the temporary `/tmp/hermes-sysroot` verification path from STORY-0001 to complete `cargo build --release` and `cargo test --release` on this host; no repo-level environment hacks were committed.

### File List

- `docs/backlog/stories/story-0004-session-switcher.md`
- `hermes-desktop/src-tauri/Cargo.toml`
- `hermes-desktop/src-tauri/src/sessions.rs`
- `hermes-desktop/src-tauri/src/main.rs`
- `hermes-desktop/src/hooks/useSessions.js`
- `hermes-desktop/src/hooks/useHermesGateway.js`
- `hermes-desktop/src/components/session-switcher.jsx`
- `hermes-desktop/src/components/statusbar.jsx`
- `hermes-desktop/src/app.jsx`
