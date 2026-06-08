# Hermes Desktop — Design Handoff
**Project:** Linux-native Claude Cowork replacement  
**Stack:** Tauri (Rust shell) + WebView frontend (React/Svelte) wrapping Hermes Agent (Python)  
**Reference app:** Claude Cowork (desktop)  
**Phase:** MVP — Phase 1 UI

---

## What We're Building

A desktop GUI for Hermes Agent that feels like Claude Cowork — but runs natively on Linux. The agent engine (Hermes) already exists and runs locally. We're designing the shell around it: the project sidebar, chat view, and session management.

The app is a thin UI wrapper. Heavy lifting lives in Hermes. The frontend talks to a local Hermes gateway via WebSocket (`ws://localhost:8765`).

---

## Core Layout

Three-panel desktop layout, similar to VS Code or Claude Cowork:

```
┌─────────────────┬──────────────────────────────────────┐
│                 │                                      │
│  LEFT SIDEBAR   │         MAIN CHAT VIEW               │
│  (260px)        │                                      │
│                 │  [conversation thread]               │
│  • Project      │                                      │
│    Switcher     │  [tool call output, collapsible]     │
│                 │                                      │
│  • File Tree    │  [composer / input bar at bottom]    │
│    (current     │                                      │
│    project)     │                                      │
│                 │                                      │
│  • Session      │                                      │
│    History      │                                      │
│                 │                                      │
└─────────────────┴──────────────────────────────────────┘
│ STATUS BAR: active model | project name | session id   │
└────────────────────────────────────────────────────────┘
```

---

## Screens / Views

### 1. Main Chat View (primary)
- Conversation thread: user messages, agent responses, tool call output
- Tool calls render as collapsible cards (open by default, collapse after completion)
- Markdown rendering with syntax highlighting
- Streaming text — response appears token-by-token
- Thinking/reasoning blocks: collapsible, subtle styling
- **Composer:** multiline input at bottom, `Shift+Enter` for newline, `Enter` to send
- File/image attach via drag-drop or paperclip icon
- Slash command autocomplete (floating panel above composer)

### 2. Left Sidebar — Project Switcher
- Dropdown or list of saved projects (`~/.hermes/projects.json`)
- "New Project" button opens a folder picker
- Active project name displayed prominently
- Click to switch project context (reloads Hermes working directory)

### 3. Left Sidebar — File Tree
- Standard collapsible directory tree for the active project folder
- Right-click context menu: open file, copy path, "add to context"
- "Add to context" injects a file reference into the composer
- Read-only in MVP — no drag-to-rearrange, no inline editing
- Dim/hide `.git`, `node_modules`, `__pycache__` by default

### 4. Left Sidebar — Session History
- List of recent sessions (title + date + token count)
- Click to resume a session
- Sessions shared with Hermes CLI (`~/.hermes/state.db`)

### 5. Settings Panel (modal or right drawer)
- Model switcher: dropdown list of configured providers/models
  - Anthropic (Claude Sonnet, Opus, Haiku)
  - OpenRouter (any model)
  - Ollama (local models)
- API key management (masked inputs)
- Theme: light / dark / system
- Active project path override

### 6. Status Bar (always visible, bottom)
- Active model name (e.g., `claude-sonnet-4-6 via anthropic`)
- Active project name
- Session ID (truncated)
- Token usage indicator for current session
- Gateway connection status dot (green/red)

---

## UX Patterns & Behavior

### Cowork parity (match these behaviors)
- Sidebar collapses to icon rail on narrow windows
- Tool output is visually distinct from agent text — subtle card/container treatment
- Skills/slash commands feel discoverable — `/` in composer opens autocomplete
- File attachments show as chips above the composer
- Sessions persist across app restarts — reopen to last session

### Hermes-specific additions
- **Project context badge:** active project name visible in sidebar header and status bar
- **File tree "add to context":** one-click way to inject a file path into the prompt
- **Model switcher in status bar:** single click to swap models mid-session

---

## Visual Direction

- **Tone:** Calm, dark-mode-first, developer tool
- **Reference:** Claude Cowork (dark), VS Code sidebar, Linear app
- **Typography:** Monospace for tool output and code blocks; system sans-serif for UI chrome
- **Density:** Medium — not cramped, not airy. Cowork's density is the target.
- **Accent color:** TBD — suggest a neutral blue or the Nous Research purple

---

## Components Needed (MVP scope)

| Component | Notes |
|-----------|-------|
| ChatMessage | User / assistant / tool variants |
| ToolCallCard | Collapsible, shows tool name + args + result |
| FileTree | Recursive folder/file list, right-click menu |
| ProjectSwitcher | Dropdown with add/remove |
| SessionList | Sidebar list with resume action |
| Composer | Multiline input, slash autocomplete, attach |
| SlashCommandPalette | Floating autocomplete above composer |
| ModelSwitcher | Dropdown in status bar |
| StatusBar | Always-visible bottom strip |
| SettingsDrawer | Modal or right-side drawer |

---

## Technical Constraints for Design

- **Frontend runs in a WebView** (Tauri) — standard HTML/CSS/JS, no native OS widgets
- **No Electron** — Tauri shell is lightweight; keep JS bundle small
- **WebSocket connection** to Hermes gateway at `ws://localhost:8765`
- **File system access** via Tauri's `fs` API (not browser APIs)
- **Recommended component lib:** shadcn/ui or Radix primitives + Tailwind
- **Recommended framework:** React or Svelte (either works in Tauri)
- Linux target: GNOME/KDE desktop, GTK-adjacent look is fine but not required

---

## Out of Scope (Phase 1 MVP)

- Mobile / tablet layout
- Multi-window / split panes
- Inline file editing
- Voice input
- Plugin management UI (install/uninstall)
- rust-orca integration (Phase 3)

---

## Handoff Notes

The Hermes backend is already built — no backend design work needed. All UI data comes from the Hermes WebSocket gateway. Treat it like designing a chat client that connects to a local API.

Start with the main chat view + sidebar layout. The file tree and project switcher can be wired up in a second pass once the chat shell is solid.
