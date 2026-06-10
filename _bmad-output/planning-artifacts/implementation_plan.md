# Workspace Desktop App — Full Implementation Plan

## Overview

Transform the Hermes Desktop app into an **agent-agnostic workspace manager** built on three pillars:

```
workspace.run(project.folder, agent.model, plugin.skill)
```

**WHERE** → `project.folder` (cwd target)
**WITH** → `agent.model` (swappable CLI harness)
**WHAT** → `plugin.skill` (on-demand capabilities)

Plus two always-loaded context layers:
- **soul.md** — philosophy, voice, values (global, never per-project)
- **os.md** — methodologies, frameworks, rules (global with per-project overrides)

Deployment targets: **Tauri desktop binary** + **Docker container** (with vault).

---

## Architecture

```
~/.workspace/                              ← central install base
  ├── soul.md                              ← always loaded (who you are)
  ├── os.md                                ← always loaded (how you operate)
  ├── skills/                              ← single source of truth
  │   ├── code-review/
  │   │   └── SKILL.md                     ← Claude Code SKILL.md format
  │   ├── bmad-method/
  │   │   └── SKILL.md
  │   └── tdd-workflow/
  │       └── SKILL.md
  └── plugins/                             ← plugin bundles
      └── my-plugin/
          ├── .claude-plugin/
          │   └── plugin.json              ← { name, version, description }
          └── skills/
              └── some-skill/
                  └── SKILL.md

~/projects/my-app/.workspace/              ← project-scoped
  ├── os.md                                ← optional override
  └── skills/                              ← symlinks to central skills
      ├── code-review → ~/.workspace/skills/code-review
      └── bmad-method → ~/.workspace/skills/bmad-method
```

### Data Flow

```
User types prompt
        │
        ▼
  ┌─────────────┐
  │  Workspace   │──── load soul.md (global)
  │  Context     │──── load os.md (project override > global)
  │  Builder     │──── resolve scoped skills
  └──────┬──────┘
         │ prepend soul + os to prompt
         ▼
  ┌─────────────┐
  │  Harness     │──── dispatch to active agent CLI
  │  Dispatcher  │──── hermes | claude | gemini | codex | pi
  └──────┬──────┘
         │ spawn CLI process with cwd = project.folder
         ▼
  ┌─────────────┐
  │  Output      │──── strip ANSI codes
  │  Cleaner     │──── collapse blank lines
  └──────┬──────┘
         │ { session_id, response, agent }
         ▼
  ┌─────────────┐
  │  Frontend    │──── display response as markdown
  │  Chat UI     │──── store session_id for --resume
  └─────────────┘
```

---

## Phase 0: Project Rename

Rename `hermes-desktop` → `workspace-desktop` everywhere. The app is agent-agnostic now.

### Folder rename
- `mv hermes-desktop workspace-desktop`

### [MODIFY] [Cargo.toml](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/src-tauri/Cargo.toml)
- Change `name = "hermes-desktop"` → `name = "workspace-desktop"`

### [MODIFY] [tauri.conf.json](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/src-tauri/tauri.conf.json)
- Update `productName`, `identifier`, window `title`

### [MODIFY] [package.json](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/package.json)
- Update `name` field

### Internal references
- Grep for "hermes-desktop" and "Hermes Desktop" across all source files
- Update settings.jsx descriptions, connect-wizard labels, etc.

---

## Phase 1: Backend — Workspace Module Integration

### [MODIFY] [main.rs](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/src-tauri/src/main.rs)
- Add `mod workspace` declaration
- Register commands: `load_workspace`, `init_workspace`, `scope_skill_to_project`
- Remove `mod gateway` and gateway-related state/commands (dead code)
- Clean up: remove `GatewayState`, `spawn_gateway`, `kill_gateway`, `get_gateway_info`

### [MODIFY] [workspace.rs](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/src-tauri/src/workspace.rs)
- Already created — needs `dirs` crate dependency added to Cargo.toml
- Verify `build_context_prefix()` produces clean markdown headers

### [MODIFY] [harness.rs](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/src-tauri/src/harness.rs)
- Import `workspace::load_workspace` and `workspace::build_context_prefix`
- In `send_prompt()`: load workspace context, prepend soul+os to prompt text before dispatching to agent harness
- Pass merged prompt to each harness's `send()` function

### [MODIFY] [Cargo.toml](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/src-tauri/Cargo.toml)
- Add `dirs = "5"` dependency for `~/.workspace` path resolution

### [DELETE] [gateway.rs](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/src-tauri/src/gateway.rs)
- Dead code. Chat is now CLI-based. No WebSocket/process management needed.

---

## Phase 2: Frontend — Clean Up Dead Code

### [DELETE] [useHermesGateway.js](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/src/hooks/useHermesGateway.js)
- 270 lines of WebSocket reconnection logic no longer used by app.jsx
- Also delete its test file

### [DELETE] [useHermesGateway.test.js](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/src/hooks/useHermesGateway.test.js)

### [MODIFY] [connect-wizard.jsx](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/src/components/connect-wizard.jsx)
- Currently oriented around gateway URL + hermes_bin
- Simplify to just agent selection (dropdown of discovered agents) + hermes_bin path

---

## Phase 3: Frontend — Workspace UI

### [NEW] [useWorkspace.js](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/src/hooks/useWorkspace.js)
- Hook that calls `invoke("load_workspace", { projectDir })` on mount and when project changes
- Returns `{ soul, os, availableSkills, loading }`
- Re-fetches when `config.active_project` changes

### [NEW] [useAgents.js](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/src/hooks/useAgents.js)
- Hook that calls `invoke("discover_agents")` on mount
- Returns `{ agents, loading }` — list of `{ name, binary, version }`
- Used by agent picker and connect wizard

### [MODIFY] [app.jsx](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/src/app.jsx)
- Import `useWorkspace` and `useAgents`
- Pass `activeAgent` to the status bar and header
- Use `config.active_project` as `cwd` for `send_prompt`
- Show active agent name in the "thinking…" indicator (e.g., "Hermes is thinking…" → "{agent} is thinking…")

### [MODIFY] [sidebar.jsx](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/src/components/sidebar.jsx)
- Add a "Workspace" tab to the tab bar (alongside Files, Scheduled, Outputs)
- Workspace tab shows:
  - **soul.md** — clickable to open in preview pane for editing
  - **os.md** — clickable to open in preview pane
  - **Skills** — list of installed/scoped skills with name + description
  - **Agent** — current active agent with dropdown to switch

### [MODIFY] [statusbar.jsx](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/src/components/statusbar.jsx)
- Replace `gateway connected/disconnected` with active agent name + version
- Replace `model: —` with `agent: hermes` (or whichever is active)
- Show project name from config instead of hardcoded `project: none`

### [MODIFY] [settings.jsx](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/src/components/settings.jsx)
- Add "Agent" dropdown field (populated from `discover_agents`)
- Add "Workspace" section showing soul.md/os.md status + init button
- Update gateway-specific labels to be agent-agnostic
- Remove/simplify gateway URL field (not needed for CLI mode)

---

## Phase 4: Docker Deployment

### [NEW] [Dockerfile](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/Dockerfile)
- Multi-stage build:
  - Stage 1: Build the Vite frontend
  - Stage 2: Runtime with Node.js (or Python for Hermes)
- Exposes a lightweight HTTP server serving the chat UI
- Mounts `~/.workspace` volume for soul.md, os.md, skills
- Mounts a vault volume (e.g., Obsidian vault at `/vault`)
- Runs agent CLIs from the container's PATH
- Environment variables for agent selection: `WORKSPACE_AGENT=hermes`

### [NEW] [docker-compose.yml](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/docker-compose.yml)
- Service: `workspace` — the chat UI + harness dispatcher
- Volumes:
  - `~/.workspace:/root/.workspace` (soul, os, skills)
  - `~/vault:/vault` (Obsidian or any vault)
  - `~/.hermes:/root/.hermes` (Hermes config/state if using Hermes)
- Ports: `3000:3000`

### [NEW] [server.js](file:///home/pakele/1-projects/ai-projects/ai-workspace/hermes-desktop/server.js)
- Lightweight Express/Fastify server for Docker mode
- `/api/send_prompt` — mirrors the Tauri `send_prompt` command (spawns CLI)
- `/api/discover_agents` — finds installed CLIs
- `/api/workspace` — loads soul.md/os.md/skills
- Serves the Vite build as static files
- Falls back to the same harness dispatch logic (just in Node.js instead of Rust)

> [!IMPORTANT]
> The Docker server.js reimplements the harness dispatch in Node.js since Tauri/Rust isn't available in container mode. The logic is simple (spawn process, capture stdout, parse output) so the port is straightforward.

---

## Phase 5: Verification

### Automated Tests
```bash
# Rust unit tests (output parsing, workspace loading)
cd hermes-desktop/src-tauri && cargo test

# Frontend unit tests
cd hermes-desktop && npm test
```

### Manual Verification
1. Launch desktop app → verify agent discovery finds installed CLIs
2. Send a prompt → verify response displays in chat
3. Check `~/.workspace/soul.md` and `os.md` are loaded
4. Switch agents via settings → verify next prompt uses new agent
5. Create project-scoped skill symlink → verify it appears in sidebar
6. Docker: `docker compose up` → open `localhost:3000` → send prompt

---

## Open Questions

> [!IMPORTANT]
> **Vault in Docker**: What vault format? Obsidian (`.md` files in folders), or a different knowledge base? This affects how the Docker compose mounts and what tools the agent gets access to.

> [!IMPORTANT]
> **Docker agent installation**: Should the Dockerfile pre-install all 5 agent CLIs, or just Hermes? Pre-installing all adds ~500MB+ but gives maximum flexibility. Alternative: user mounts their own agent binaries.

> [!IMPORTANT]
> **soul.md / os.md editing**: Should the desktop app have an inline editor for these files, or just open them in the preview pane (read-only) and let the user edit externally?

---

## Task Checklist

### Phase 0: Project Rename
- [ ] 0.1 Rename folder `hermes-desktop` → `workspace-desktop`
- [ ] 0.2 Update `Cargo.toml` name
- [ ] 0.3 Update `tauri.conf.json` — productName, identifier, window title
- [ ] 0.4 Update `package.json` name
- [ ] 0.5 Grep and replace all "hermes-desktop" / "Hermes Desktop" references in source
- [ ] 0.6 Verify build after rename (`cargo build --release` + `npm run build`)

### Phase 1: Backend Workspace Integration
- [ ] 1.1 Add `dirs = "5"` to Cargo.toml
- [ ] 1.2 Register workspace commands in main.rs (`load_workspace`, `init_workspace`, `scope_skill_to_project`)
- [ ] 1.3 Wire `build_context_prefix()` into `harness::send_prompt()` — prepend soul+os to every prompt
- [ ] 1.4 Remove gateway module from main.rs (mod, state, commands)
- [ ] 1.5 Delete gateway.rs
- [ ] 1.6 `cargo build --release` — verify clean compile

### Phase 2: Frontend Dead Code Cleanup
- [ ] 2.1 Delete `useHermesGateway.js` and its test
- [ ] 2.2 Remove gateway imports from any remaining files
- [ ] 2.3 Simplify connect-wizard.jsx (agent selection instead of gateway URL)
- [ ] 2.4 `npm run build` — verify clean frontend build

### Phase 3: Frontend Workspace UI
- [ ] 3.1 Create `useWorkspace.js` hook
- [ ] 3.2 Create `useAgents.js` hook
- [ ] 3.3 Add "Workspace" tab to sidebar with soul/os/skills/agent display
- [ ] 3.4 Update statusbar: show agent name, project name, remove gateway status
- [ ] 3.5 Update settings.jsx: add agent dropdown, workspace section, remove gateway URL
- [ ] 3.6 Update app.jsx: integrate useWorkspace, useAgents, dynamic thinking indicator
- [ ] 3.7 `npm run build` — verify clean build

### Phase 4: Docker Deployment
- [ ] 4.1 Create server.js — Express/Fastify server mirroring Tauri commands
- [ ] 4.2 Implement `/api/send_prompt` endpoint (harness dispatch in Node.js)
- [ ] 4.3 Implement `/api/discover_agents` endpoint
- [ ] 4.4 Implement `/api/workspace` endpoint (load soul/os/skills)
- [ ] 4.5 Create Dockerfile (multi-stage: build frontend + runtime)
- [ ] 4.6 Create docker-compose.yml with workspace + vault volumes
- [ ] 4.7 Test: `docker compose up` → verify UI loads at localhost:3000

### Phase 5: Full Build & Verify
- [ ] 5.1 `cargo test` — Rust unit tests pass
- [ ] 5.2 `npm test` — frontend tests pass (update broken tests)
- [ ] 5.3 Full Tauri build (`npx @tauri-apps/cli build`) — all 3 bundles
- [ ] 5.4 Manual smoke test: launch app, send prompt, verify soul/os injection
- [ ] 5.5 Commit and push
