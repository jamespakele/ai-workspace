---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics"]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/hermes-ui-design-handoff.md
  - ui/claude-design/ (prototype components)
---

# Hermes Desktop - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Hermes Desktop, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Display streaming agent responses token-by-token (P0)
FR2: Render markdown in agent responses — headings, bold, code blocks, bullets (P0)
FR3: Display tool calls as collapsible cards showing tool name, args, result (P0)
FR4: Tool call cards default expanded during execution, collapse on completion (P1)
FR5: Display thinking/reasoning blocks as collapsible, visually muted sections (P1)
FR6: Show diff output inside Edit file tool cards with syntax highlighting (P1)
FR7: Display user messages with distinct visual treatment (YOU avatar/badge) (P0)
FR8: Syntax highlight code blocks inside agent responses (P1)
FR9: Show session title and message count in chat header (P2)
FR10: Multiline text input; Enter sends, Shift+Enter newline (P0)
FR11: File attachment via paperclip icon — sends file path to Hermes (P1)
FR12: `/` in composer opens slash command palette (floating autocomplete) (P1)
FR13: Slash command palette shows command name + description (P1)
FR14: Attached files show as chips above composer before send (P2)
FR15: Sidebar header shows active project name and path (P0)
FR16: Dropdown to switch between saved projects from `~/.hermes/projects.json` (P0)
FR17: "New Project" action opens folder picker, adds to projects list (P1)
FR18: Switching project updates file tree and notifies Hermes gateway (P0)
FR19: Display collapsible directory tree for active project folder (P0)
FR20: Hide `.git`, `node_modules`, `__pycache__`, `.venv` by default (P1)
FR21: Right-click context menu: "Copy path", "Add to context" (P1)
FR22: "Add to context" injects file path reference into composer (P1)
FR23: Read-only file tree in Phase 1 — no inline editing (P0)
FR24: Nav bar shows current session title as a dropdown (P0)
FR25: Dropdown lists recent sessions: title, date, token count (last 50) (P0)
FR26: Sessions read from `~/.hermes/state.db` (P0)
FR27: Clicking a session resumes it via Hermes gateway (session ID handoff) (P1)
FR28: "New Session" option in dropdown starts a fresh session (P1)
FR29: Active file (if known from tool calls) is highlighted in tree (P2)
FR30: Accept `.skill` zip drag-drop/picker, extract SKILL.md + scripts, copy to `~/.hermes/skills/<name>/`, show confirmation (P1-P2)

### NonFunctional Requirements

NFR1: Startup time — app window visible in under 2 seconds
NFR2: Streaming latency — first token renders within 200ms of gateway send
NFR3: Bundle size — Tauri target < 10MB installer
NFR4: Memory — < 150MB resident while idle (Hermes process not counted)
NFR5: Platform — Linux (Ubuntu 22.04+, Fedora 38+, Arch); GNOME and KDE

### Additional Requirements

- AR1: Use TUI Gateway JSON-RPC over WebSocket as the integration protocol
- AR2: Implement RPC methods: session.create, session.list, session.history, session.resume, session.status, session.interrupt, prompt.submit, command.dispatch
- AR3: Handle streamed events: message.delta, message.complete, tool.start, tool.progress, tool.complete, approval.request, clarify.request, gateway.ready, session.error
- AR4: Model hot-swap via command.dispatch with /model — no reconnection needed
- AR5: Tauri Rust backend reads state.db read-only with SqliteConnectOptions::read_only(true)
- AR6: Session list query: join sessions + messages tables, filter source = 'cli', limit 50, include preview
- AR7: App config persisted at ~/.config/hermes-desktop/config.json with fields: hermes_bin, gateway_url, auto_start_gateway, active_project
- AR8: Gateway lifecycle: auto-start spawns hermes --tui, exponential backoff (500ms → 30s, ±30% jitter), kill owned PID on close
- AR9: Frontend hooks architecture: useHermesGateway, useSessions, useFileTree, useProjects, useAppConfig
- AR10: Skill importer: no hot-reload — show "Restart gateway to activate" notice after import
- AR11: Tauri commands: list_sessions, get_session_messages, read_dir, list_projects, add_project, get_config, save_config, spawn_gateway, kill_gateway
- AR12: Tech stack: Tauri 2.x, React 18, shadcn/ui + Tailwind, sqlx 0.7, Vite 5.x, Tauri plugins (dialog, fs, shell, store)

### UX Design Requirements

UX-DR1: Three-panel desktop layout (260px sidebar + main chat view + 28px status bar) matching Claude Cowork density
UX-DR2: Dark-mode-first design — Canvas #0F0F11, Sidebar #161618, accent Nous Purple #7C3AED; Inter for UI chrome, JetBrains Mono for code/data
UX-DR3: ChatMessage component — user messages with "you" avatar/badge, assistant messages with Hermes icon, flat thread (no bubbles for assistant)
UX-DR4: ToolCallCard component — collapsible bordered card with icon + name + status header, three body renderers (read/line refs, diff/+- hunk, terminal/mono output), color-coded (blue/green)
UX-DR5: Sidebar component — ProjectSwitcher dropdown, recursive FileTree with right-click ContextMenu (Open, Add to context, Copy path), collapsible Sessions section
UX-DR6: Composer component — multiline textarea with auto-resize (max 220px), file attachment chips above input, paperclip + send/stop buttons, keyboard hint footer
UX-DR7: SlashCommandPalette component — floating panel above composer, icon + command name + description per item, arrow-key navigation + Tab/Enter to select
UX-DR8: StatusBar component — connection dot (green/amber/red with label), ModelSwitcher dropdown (grouped by provider with check mark), project label, session ID (mono), token usage bar
UX-DR9: Markdown renderer — lightweight custom component handling paragraphs, bold, italic, inline code, fenced code blocks, bullet/ordered lists, headings, plus typewriter cursor for streaming
UX-DR10: ThinkingBlock component — collapsible "Thought for a moment" section with brain icon and chevron toggle, subtle/muted styling

### FR Coverage Map

FR1: Epic 2 — Streaming token-by-token display
FR2: Epic 2 — Markdown rendering in responses
FR3: Epic 2 — Tool call collapsible cards
FR4: Epic 2 — Tool cards expand/collapse behavior
FR5: Epic 2 — Thinking blocks collapsible
FR6: Epic 2 — Diff output in Edit tool cards
FR7: Epic 2 — User message visual treatment
FR8: Epic 2 — Syntax highlight code blocks
FR9: Epic 2 — Session title + message count in header
FR10: Epic 2 — Multiline input, Enter/Shift+Enter
FR11: Epic 5 — File attachment via paperclip
FR12: Epic 5 — Slash command palette on /
FR13: Epic 5 — Slash command name + description
FR14: Epic 5 — Attached file chips
FR15: Epic 3 — Active project name in sidebar
FR16: Epic 3 — Project switcher dropdown
FR17: Epic 3 — New Project folder picker
FR18: Epic 3 — Project switch updates tree + gateway
FR19: Epic 3 — Collapsible directory tree
FR20: Epic 3 — Hide .git, node_modules, etc.
FR21: Epic 3 — Right-click context menu
FR22: Epic 3 — "Add to context" → composer
FR23: Epic 3 — Read-only file tree
FR24: Epic 4 — Session title dropdown
FR25: Epic 4 — Recent sessions list
FR26: Epic 4 — Sessions from state.db
FR27: Epic 4 — Click to resume session
FR28: Epic 4 — New Session action
FR29: Epic 3 — Active file highlight
FR30: Epic 7 — Skill zip import

## Epic List

### Epic 1: Tauri App Shell & Gateway Connection
A developer on Linux can launch the Hermes Desktop app, it connects to a running Hermes gateway via WebSocket, and they see a working three-panel window layout with live connection status. The app can auto-start the gateway process and manages its lifecycle.
**FRs covered:** (infrastructure — enables all FRs)
**ARs covered:** AR1, AR7, AR8, AR11 (spawn_gateway, kill_gateway, get_config, save_config), AR12
**NFRs covered:** NFR1, NFR3, NFR4, NFR5
**UX-DRs covered:** UX-DR1, UX-DR2

### Epic 2: Chat Conversation & Streaming
A developer can send messages to Hermes and receive streaming responses with full markdown rendering, tool call cards (read, edit, terminal, diff views), and collapsible thinking blocks — a fully functional chat session with the agent.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10
**ARs covered:** AR2 (prompt.submit, session.create), AR3 (message.delta, message.complete, tool.start, tool.progress, tool.complete, approval.request, clarify.request, session.error), AR9 (useHermesGateway)
**NFRs covered:** NFR2
**UX-DRs covered:** UX-DR3, UX-DR4, UX-DR9, UX-DR10

### Epic 3: Project Sidebar & File Tree
A developer can browse their project files in the sidebar, switch between saved projects, add new projects via folder picker, and inject file paths into the composer as context — with the file tree updating when projects change.
**FRs covered:** FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR29
**ARs covered:** AR9 (useFileTree, useProjects), AR11 (read_dir, list_projects, add_project)
**UX-DRs covered:** UX-DR5

### Epic 4: Session Management & Persistence
A developer can see their recent sessions in the sidebar, switch between them to resume past conversations, start new sessions, and have sessions persist across app restarts — reading directly from Hermes state.db.
**FRs covered:** FR24, FR25, FR26, FR27, FR28
**ARs covered:** AR2 (session.list, session.history, session.resume), AR5, AR6, AR9 (useSessions), AR11 (list_sessions, get_session_messages)
**UX-DRs covered:** UX-DR5 (session list)

### Epic 5: Composer Enhancements & Slash Commands
A developer can attach files to messages as removable context chips, use `/` to discover and invoke slash commands via a floating autocomplete palette, with full keyboard navigation support.
**FRs covered:** FR11, FR12, FR13, FR14
**ARs covered:** AR2 (command.dispatch)
**UX-DRs covered:** UX-DR6, UX-DR7

### Epic 6: Model Switching, Settings & Status Bar
A developer can view live connection and session status in the status bar, switch between AI models (Anthropic, OpenRouter, Ollama) mid-session, and configure app settings including gateway URL, auto-start, and binary path.
**FRs covered:** (Status bar B1-B5, Settings T1-T6 from PRD)
**ARs covered:** AR4, AR7, AR9 (useAppConfig), AR11 (get_config, save_config)
**UX-DRs covered:** UX-DR8

### Epic 7: Skill Importer
A developer can import .skill zip files into Hermes via drag-drop or file picker, with the app extracting SKILL.md and scripts to the correct directory, showing confirmation with skill name and trigger phrases, and a notice to restart the gateway.
**FRs covered:** FR30
**ARs covered:** AR10
**UX-DRs covered:** (new UI)
