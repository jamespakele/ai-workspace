# Hermes Desktop — Architecture Document

**Version:** 0.1  
**Status:** Draft  
**Date:** 2026-06-08  
**Sources:** [Hermes Agent Docs](https://hermes-agent.nousresearch.com/docs/), GitHub source  

---

## 1. System Overview

Hermes Desktop is a Tauri application that provides a Claude Cowork-quality UI shell around Hermes Agent. The architecture is explicitly thin-on-top: the Tauri app handles display, input, and file system access; Hermes handles all agent intelligence, session persistence, and model provider communication.

```
┌─────────────────────────────────────────────────────────────┐
│                    Hermes Desktop (Tauri)                    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              WebView (React Frontend)                 │  │
│  │                                                       │  │
│  │  Sidebar        Chat View          Status Bar        │  │
│  │  ├ Project      ├ Messages         ├ Model            │  │
│  │  ├ File Tree    ├ Tool Cards       ├ Session          │  │
│  │  └ Sessions▾   └ Composer         └ Connection       │  │
│  └──────────────┬──────────┬────────────────────────────┘  │
│                 │          │                                 │
│  ┌──────────────▼──┐  ┌───▼───────────────────────────┐    │
│  │  Tauri Commands │  │   WebSocket Client             │    │
│  │  (Rust backend) │  │   TUI Gateway JSON-RPC         │    │
│  │  ├ list_sessions│  │   tui_gateway/ws.py            │    │
│  │  ├ read_dir     │  └───────────────┬───────────────┘    │
│  │  ├ read_projects│                  │                     │
│  │  └ app_config   │                  │                     │
│  └──────────────┬──┘                  │                     │
└─────────────────┼─────────────────────┼─────────────────────┘
                  │                     │
         SQLite read           JSON-RPC over WS
         (state.db)            (messages, events)
                  │                     │
┌─────────────────▼─────────────────────▼─────────────────────┐
│                    Hermes Agent (Python)                     │
│                                                             │
│  TUI Gateway WS ──► AIAgent ──► Provider (Claude/OpenRouter/│
│                                  Ollama)                    │
│  hermes_state.py (SQLite, WAL)                              │
│  ~/.hermes/state.db                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Integration Protocol

### 2.1 TUI Gateway JSON-RPC (Chosen Protocol)

Hermes ships three programmatic integration protocols. For a custom desktop UI the docs explicitly recommend the **TUI Gateway JSON-RPC** over WebSocket:

> "You're writing a custom desktop / web / TUI host and want every Hermes feature → TUI gateway JSON-RPC"

Entry point: `tui_gateway/ws.py` (WebSocket transport layer over the TUI gateway server)  
Started by: `hermes --tui` or by spawning the gateway directly

This gives us every feature we need: session management, streaming events, slash command dispatch, model hot-swapping, approval callbacks.

### 2.2 Key RPC Methods

| Method | Purpose |
|--------|---------|
| `session.create` | Start a new session |
| `session.list` | List recent sessions |
| `session.history` | Get messages for a session |
| `session.resume` / `session.status` | Resume or check a session |
| `session.interrupt` | Stop current generation (user hits Escape) |
| `prompt.submit` | Send a message, start a turn |
| `command.dispatch` | Send a slash command (e.g. `/model claude-sonnet-4`) |
| `session.branch` | Fork session at a point |
| `session.compress` | Trigger context compression |
| `reload.mcp` | Reload MCP servers without restart |

### 2.3 Streamed Events

The gateway streams these events back to the UI:

| Event | What to do |
|-------|-----------|
| `message.delta` | Append token to current assistant bubble |
| `message.complete` | Finalize the bubble, save token count |
| `tool.start` | Render a ToolCallCard in "running" state |
| `tool.progress` | Update ToolCallCard with partial output |
| `tool.complete` | Collapse ToolCallCard to "done" state |
| `approval.request` | Show approval dialog to user |
| `clarify.request` | Show clarify dialog |
| `gateway.ready` | Gateway is up — set status bar dot green |
| `session.error` | Surface error in chat view |

### 2.4 Model Hot-Swapping

Mid-session model changes are handled via slash command dispatch — no reconnection needed:

```json
{ "method": "command.dispatch", "params": { "command": "/model anthropic:claude-sonnet-4-6" } }
```

The model field in the session record updates in `state.db` after the switch.

---

## 3. Session Storage

Hermes uses SQLite (`~/.hermes/state.db`, WAL mode). The Tauri Rust backend reads it directly for the sessions list — this works even when the gateway is offline, which matters for the nav bar dropdown.

### 3.1 Sessions Table (relevant columns)

```sql
CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,     -- e.g. "sess_abc123"
    title       TEXT,                 -- user-visible name, unique when non-null
    source      TEXT NOT NULL,        -- "cli", "telegram", "discord", etc.
    model       TEXT,                 -- "anthropic/claude-sonnet-4.6"
    started_at  REAL NOT NULL,        -- Unix epoch float
    ended_at    REAL,
    message_count    INTEGER DEFAULT 0,
    input_tokens     INTEGER DEFAULT 0,
    output_tokens    INTEGER DEFAULT 0,
    estimated_cost_usd REAL
);
```

### 3.2 Session List Query (nav bar dropdown)

```sql
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
LIMIT 50;
```

### 3.3 Write Contention

Hermes handles write contention with 15-retry jitter (20–150ms) and periodic WAL checkpoints. The Tauri backend should open the database **read-only** to avoid interfering with Hermes writes:

```rust
SqliteConnectOptions::new()
    .filename(&db_path)
    .read_only(true)
```

---

## 4. Component Architecture

### 4.1 Tauri Backend (Rust)

Handles: file system access, SQLite reads, app config, process spawning.

**Commands exposed to frontend:**

```rust
#[tauri::command] list_sessions() -> Vec<SessionSummary>
#[tauri::command] get_session_messages(session_id: String) -> Vec<Message>
#[tauri::command] read_dir(path: String) -> Vec<DirEntry>
#[tauri::command] list_projects() -> Vec<Project>        // reads ~/.hermes/projects.json
#[tauri::command] add_project(path: String) -> ()
#[tauri::command] get_config() -> AppConfig
#[tauri::command] save_config(config: AppConfig) -> ()
#[tauri::command] spawn_gateway() -> ()                  // hermes --tui
#[tauri::command] kill_gateway() -> ()
```

**App config** stored at `~/.config/hermes-desktop/config.json`:

```json
{
  "hermes_bin": "/home/user/.local/bin/hermes",
  "gateway_url": "ws://localhost:8765",
  "auto_start_gateway": true,
  "active_project": "/home/user/code/my-project"
}
```

### 4.2 React Frontend

Built from the Claude Design component set (`ui/claude-design/`). State is managed via React hooks; no global state library needed for Phase 1.

**Key hooks:**

```typescript
useHermesGateway(url)     // WebSocket connection, RPC dispatch, event stream
useSessions()             // Tauri invoke('list_sessions') — SQLite read
useFileTree(path)         // Tauri invoke('read_dir') — recursive
useProjects()             // Tauri invoke('list_projects')
useAppConfig()            // Tauri invoke('get_config')
```

**Component tree:**

```
App
├── TitleBar
│   ├── ProjectSwitcher (dropdown → useProjects)
│   └── SessionSwitcher (dropdown → useSessions)
├── Sidebar
│   └── FileTree (useFileTree)
├── ChatView
│   ├── MessageList
│   │   ├── UserMessage
│   │   ├── AssistantMessage (streams via message.delta)
│   │   └── ToolCallCard (tool.start / tool.complete)
│   └── Composer
│       └── SlashCommandPalette
└── StatusBar
    ├── ConnectionDot
    ├── ModelLabel (clickable → command.dispatch /model)
    ├── ProjectLabel
    ├── SessionLabel
    └── TokenCounter
```

### 4.3 Skill Importer

A simple Python script (bundled as a Tauri sidecar) or a Tauri command in Rust:

1. Accept `.skill` zip via file picker (Tauri `dialog` API)
2. Extract `SKILL.md` + `scripts/` from zip
3. Read `name:` from `SKILL.md` frontmatter
4. Copy to `~/.hermes/skills/<name>/`
5. Return skill name and trigger phrases to the UI for confirmation toast

> **Note on hot-reload:** Hermes does not have a `reload.skills` RPC method. New skills take effect at the next session start. The UI should display a "Restart gateway to activate skill" notice after import.

---

## 5. Tech Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Desktop shell | Tauri | 2.x | Rust backend + WebView |
| Frontend framework | React | 18 | Already in claude-design components |
| Component library | shadcn/ui + Tailwind | latest | Used in claude-design |
| WebSocket | Native browser WS API | — | No library needed |
| SQLite (Rust) | sqlx | 0.7 | Read-only, async |
| File dialogs | `@tauri-apps/plugin-dialog` | 2.x | For skill import, project picker |
| File system | `@tauri-apps/plugin-fs` | 2.x | For file tree |
| Shell | `@tauri-apps/plugin-shell` | 2.x | For spawning `hermes --tui` |
| Config | `@tauri-apps/plugin-store` | 2.x | Persistent app config |
| Build | Vite | 5.x | Default Tauri 2 bundler |
| Agent backend | Hermes Agent | latest | Python, MIT license |

---

## 6. Gateway Lifecycle

```
App start
    │
    ├─ Read config (hermes_bin, gateway_url, auto_start)
    │
    ├─ [auto_start = true] → spawn `hermes --tui`
    │                         wait for `gateway.ready` event
    │
    ├─ Connect WebSocket to gateway_url
    │
    ├─ [connected] → green dot in status bar
    │                 call session.list, load last session
    │
    └─ [disconnected] → exponential backoff (500ms → 30s, ±30% jitter)
                        amber dot while retrying, red dot on give-up

App close
    └─ [owns gateway PID] → kill process
       [gateway external] → close WS, leave process running
```

---

## 7. Project Structure (Tauri App)

```
hermes-desktop/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs          # Tauri app init, command registration
│       ├── sessions.rs      # SQLite read: list_sessions, get_messages
│       ├── config.rs        # App config read/write
│       ├── projects.rs      # projects.json read/write
│       ├── fs.rs            # read_dir (file tree)
│       └── gateway.rs       # spawn/kill hermes --tui
│
└── src/
    ├── app.jsx              # Root component (from claude-design)
    ├── hooks/
    │   ├── useHermesGateway.js
    │   ├── useSessions.js
    │   ├── useFileTree.js
    │   └── useProjects.js
    ├── components/          # From claude-design
    │   ├── sidebar.jsx
    │   ├── message.jsx
    │   ├── toolcard.jsx
    │   ├── composer.jsx
    │   ├── statusbar.jsx
    │   └── markdown.jsx
    └── styles/
        └── globals.css      # Tailwind + design tokens
```

---

## 8. Data Flows

### 8.1 User sends a message

```
Composer (Enter key)
  → useHermesGateway.send({ method: "prompt.submit", params: { text, session_id } })
  → WebSocket → Hermes TUI Gateway
  → AIAgent.run_conversation()
  → stream events back:
      tool.start      → ToolCallCard renders "running"
      message.delta   → AssistantMessage appends token
      tool.complete   → ToolCallCard collapses to "done"
      message.complete → finalize, update token counter
```

### 8.2 User opens session dropdown

```
SessionSwitcher click
  → invoke('list_sessions')   [Tauri → Rust → SQLite read]
  → returns Vec<SessionSummary> {id, title, model, started_at, total_tokens, preview}
  → render dropdown list
  → user selects session
  → gateway.send({ method: "session.resume", params: { session_id } })
  → ChatView loads history from session.history response
```

### 8.3 User switches model

```
StatusBar model label click
  → ModelSwitcher dropdown opens
  → user picks "openrouter:meta/llama-3.1-70b"
  → gateway.send({ method: "command.dispatch", params: { command: "/model openrouter:meta/llama-3.1-70b" } })
  → Hermes switches provider mid-session (no restart needed)
  → status bar label updates to new model name
```

### 8.4 User adds project

```
ProjectSwitcher → "New Project" → Tauri dialog.open({ directory: true })
  → returns path string
  → invoke('add_project', { path })   [Rust writes ~/.hermes/projects.json]
  → ProjectSwitcher dropdown refreshes
  → invoke switches active project context
  → FileTree reloads with new path
  → gateway.send context file injection (AGENTS.md if present)
```

---

## 9. Resolved Open Questions

| # | Question | Answer |
|---|----------|--------|
| Q1 | Does gateway include `session_id` in messages? | Yes — TUI Gateway RPC has full session management: `session.create`, `session.list`, `session.resume`, `session.history`. Session IDs (`sess_abc123`) are first-class. |
| Q2 | Exact `state.db` session schema? | Fully documented. Key fields: `id TEXT`, `title TEXT`, `model TEXT`, `started_at REAL`, `input_tokens INT`, `output_tokens INT`. Schema version 11 current. |
| Q3 | `hermes sessions list --json`? | Not needed. Use `session.list` via TUI Gateway RPC (preferred), or direct SQLite read (offline-capable). |
| Q4 | How to signal model change to UI? | `command.dispatch` with `{"command": "/model provider:model"}`. Model also stored in `sessions.model` in SQLite. |
| Q5 | Skill hot-reload? | No `reload.skills` RPC exists. Skills activate at next session start. UI should show "restart gateway to activate" notice after import. |

---

## 10. Phase Boundaries

### Phase 1 (This doc)
Tauri shell + TUI Gateway JSON-RPC + SQLite session reads + file tree + project switcher + skill importer. No custom backend logic. All intelligence in Hermes.

### Phase 2 (Deferred)
- Resizable panels (drag sidebar width)
- Keyboard navigation (Vim-style j/k in session list)
- Light theme
- Multi-window support
- Plugin management UI

### Phase 3 (Deferred — rust-orca)
- Rust MCP orchestration layer between Tauri and Hermes
- JIT Capability Handshake via Anansi semantic search
- Markdown Flight Cards for structured tool dispatch
- Single `orca_dispatch` tool exposed to Hermes (context window protection)
- See: `rust-orca` PRD
