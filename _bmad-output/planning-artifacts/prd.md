# Hermes Desktop — Product Requirements Document

**Version:** 0.1  
**Status:** Draft  
**Date:** 2026-06-08  
**Owner:** James Pakele  

---

## 1. Problem

Claude Cowork (the Anthropic desktop app) has no Linux version. Developers on Linux who rely on Claude Cowork's agentic coding workflow — file tree context, tool call visibility, session history, skill/plugin system — have no native equivalent.

Hermes Agent (NousResearch, MIT license) provides the full agent backend: WebSocket gateway, model provider switching (Anthropic, OpenRouter, Ollama), MCP support, session persistence, and a skill system. It runs on Linux. It lacks a Cowork-quality desktop UI.

**The gap:** Hermes has the engine. There is no shell.

---

## 2. Solution

**Hermes Desktop** — a Tauri-based desktop application for Linux that wraps the Hermes Agent backend in a Claude Cowork-quality UI. The app is a thin frontend shell. All agent intelligence lives in Hermes; the app's job is to surface it clearly.

---

## 3. Target User

- Developers working on Linux who currently use Claude Cowork on Mac/Windows
- AI practitioners who want a local-first, model-agnostic agentic coding environment
- James Pakele and the Pakele.ai team as the immediate power users

---

## 4. Guiding Principles

- **Thin shell, thick engine.** The app does not reimplement what Hermes already does. It exposes it.
- **Cowork parity first.** If Cowork does it, Hermes Desktop should feel equivalent or better.
- **Local-first.** No cloud dependency. Everything runs on the user's machine.
- **Model-agnostic.** Provider switching (Claude, OpenRouter, Ollama) is a first-class feature.
- **Open by default.** MIT license. No telemetry.

---

## 5. Phase Plan

| Phase | Scope | Status |
|-------|-------|--------|
| **1 — MVP** | Tauri shell + chat + sidebar + sessions + settings | **This document** |
| **2 — GUI Polish** | Drag-resize panels, keyboard navigation, theme support | Deferred |
| **3 — rust-orca** | Rust-based MCP orchestration layer (Nervous System) | Deferred |

---

## 6. Phase 1 Requirements

### 6.1 Chat Interface

| ID | Requirement | Priority |
|----|-------------|----------|
| C1 | Display streaming agent responses token-by-token | P0 |
| C2 | Render markdown in agent responses (headings, bold, code blocks, bullets) | P0 |
| C3 | Display tool calls as collapsible cards (tool name, args, result) | P0 |
| C4 | Tool call cards default to expanded during execution, collapse on completion | P1 |
| C5 | Display thinking/reasoning blocks as collapsible, visually muted sections | P1 |
| C6 | Show diff output inside Edit file tool cards with syntax highlighting | P1 |
| C7 | Display user messages with distinct visual treatment (YOU avatar/badge) | P0 |
| C8 | Syntax highlight code blocks inside agent responses | P1 |
| C9 | Session title and message count shown in chat header | P2 |

### 6.2 Composer

| ID | Requirement | Priority |
|----|-------------|----------|
| M1 | Multiline text input; `Enter` sends, `Shift+Enter` inserts newline | P0 |
| M2 | File attachment via paperclip icon (sends file path to Hermes) | P1 |
| M3 | `/` in composer opens slash command palette (floating autocomplete) | P1 |
| M4 | Slash command palette shows command name + description | P1 |
| M5 | Attached files show as chips above the composer before send | P2 |

### 6.3 Sidebar — Project Switcher

| ID | Requirement | Priority |
|----|-------------|----------|
| P1 | Sidebar header shows active project name and path | P0 |
| P2 | Dropdown to switch between saved projects (`~/.hermes/projects.json`) | P0 |
| P3 | "New Project" action opens folder picker, adds to projects list | P1 |
| P4 | Switching project updates file tree and notifies Hermes gateway | P0 |

### 6.4 Sidebar — File Tree

| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | Display collapsible directory tree for the active project folder | P0 |
| F2 | Hide `.git`, `node_modules`, `__pycache__`, `.venv` by default | P1 |
| F3 | Right-click context menu: "Copy path", "Add to context" | P1 |
| F4 | "Add to context" injects file path reference into composer | P1 |
| F5 | Active file (if known from tool calls) is highlighted in tree | P2 |
| F6 | Read-only in Phase 1 — no inline editing | P0 |

### 6.5 Navigation Bar — Session Switcher

| ID | Requirement | Priority |
|----|-------------|----------|
| S1 | Navigation bar shows current session title as a dropdown | P0 |
| S2 | Dropdown lists recent sessions: title, date, token count (last 50) | P0 |
| S3 | Sessions read from `~/.hermes/state.db` | P0 |
| S4 | Clicking a session resumes it via Hermes gateway (session ID handoff) | P1 |
| S5 | "New Session" option in dropdown starts a fresh session | P1 |

### 6.6 Status Bar

| ID | Requirement | Priority |
|----|-------------|----------|
| B1 | Always-visible 28px strip at bottom of window | P0 |
| B2 | Shows: gateway connection dot (green/red), active model name, provider, project name, session ID (truncated), token count | P0 |
| B3 | Clicking model name opens model switcher dropdown | P1 |
| B4 | Model switcher lists configured providers and models | P1 |
| B5 | Gateway reconnect indicator (animated dot when retrying) | P1 |

### 6.7 Settings

| ID | Requirement | Priority |
|----|-------------|----------|
| T1 | Settings accessible via gear icon in status bar | P0 |
| T2 | Hermes binary path (auto-detected from `$PATH`, manually overridable) | P0 |
| T3 | Gateway URL (default: `ws://localhost:8765`) | P0 |
| T4 | Active project folder path override | P1 |
| T5 | "Auto-start gateway on launch" toggle (spawns `hermes serve`) | P1 |
| T6 | Settings persisted in app config (`~/.config/hermes-desktop/config.json`) | P0 |

### 6.8 Skill Importer

| ID | Requirement | Priority |
|----|-------------|----------|
| I1 | Accept `.skill` zip file drag-drop or file picker | P1 |
| I2 | Extract `SKILL.md` and `scripts/` from zip | P1 |
| I3 | Copy contents to `~/.hermes/skills/<skill-name>/` | P1 |
| I4 | Show import confirmation with skill name and trigger phrases | P2 |

### 6.9 Gateway Lifecycle

| ID | Requirement | Priority |
|----|-------------|----------|
| G1 | App attempts WebSocket connection on launch | P0 |
| G2 | If gateway not running and auto-start enabled, spawn `hermes serve` | P1 |
| G3 | Exponential backoff reconnect (500ms start, 30s ceiling, ±30% jitter) | P1 |
| G4 | Connection state surfaced in status bar dot | P0 |
| G5 | App kills spawned gateway on close (if it owns the process) | P1 |

---

## 7. Design System

- **Design tokens:** See `stitch_linux_desktop_ai_agent/hermes_high_density_professional/DESIGN.md`
- **React components:** See `ui/claude-design/` (app.jsx + component files)
- **Key values:** Canvas `#0F0F11`, Sidebar `#161618`, Nous Purple `#7C3AED`
- **Fonts:** Inter (UI chrome), JetBrains Mono (code/data/status bar)
- **Sidebar width:** 260px fixed
- **Status bar height:** 28px fixed
- **Base grid:** 4px

---

## 8. Non-Functional Requirements

- **Startup time:** App window visible in under 2 seconds
- **Streaming latency:** First token renders within 200ms of gateway send
- **Bundle size:** Tauri target < 10MB installer
- **Memory:** < 150MB resident while idle (Hermes process not counted)
- **Platform:** Linux (Ubuntu 22.04+, Fedora 38+, Arch); GNOME and KDE

---

## 9. Out of Scope — Phase 1

- Mobile / tablet layout
- Multi-window or split panes
- Inline file editing
- Voice input
- Plugin management UI (install / uninstall via UI)
- rust-orca integration
- Light theme
- Windows / macOS builds (those have Hermes Desktop app already)

---

## 10. Open Questions

| # | Question | Owner | Notes |
|---|----------|-------|-------|
| Q1 | Does the Hermes gateway include `session_id` in every message envelope? | Spike | Verify by inspecting WS traffic with `wscat` |
| Q2 | Exact `state.db` table schema for sessions? | Spike | `sqlite3 ~/.hermes/state.db .schema` |
| Q3 | Does `hermes sessions list --json` exist? | Spike | Prefer CLI over direct SQLite read if available |
| Q4 | How does Hermes signal model change back to the UI? | Spike | Check gateway protocol docs / source |
| Q5 | Skill import: does Hermes watch `~/.hermes/skills/` at runtime or require restart? | Spike | Determines whether hot-reload is possible |

---

## 11. Success Criteria

Phase 1 is complete when:

1. A developer on Ubuntu can install the app, point it at a Hermes install, and have a working chat session with file tree context within 5 minutes of first launch.
2. Sessions persist across app restarts and are resumable from the nav bar dropdown.
3. Tool call output renders correctly for the three most common Hermes tools (read_file, edit_file, run_command).
4. A `.skill` file from Claude Cowork can be imported and its trigger phrases appear in the slash command palette.
