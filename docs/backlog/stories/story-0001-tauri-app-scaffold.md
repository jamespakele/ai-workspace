---
story_id: "STORY-0001"
title: "Tauri Application Scaffold"
status: "DRAFT"
po_alignment: "PENDING"
created_at: "2026-06-08"
updated_at: "2026-06-08"
epic: "foundation"
depends_on: []
---

# Story 0001: Tauri Application Scaffold

Status: DRAFT

## Story

As a developer on the Hermes Desktop project,
I want a fully initialized Tauri 2.x application with a React frontend and the correct directory structure,
so that all subsequent feature stories have a buildable, runnable base to build upon.

## Acceptance Criteria

1. Running `cargo tauri dev` from `hermes-desktop/` starts the application window without errors.
2. The directory layout exactly matches architecture.md §7 (all source directories and files present, stubs acceptable).
3. All Tauri plugins declared in the tech stack (plugin-dialog, plugin-fs, plugin-shell, plugin-store) are installed and compile.
4. All Rust backend commands listed in architecture.md §4.1 exist as stub functions registered with Tauri (they may return `Ok(Default::default())` for now).
5. The React frontend compiles via Vite 5.x with React 18, Tailwind CSS, and shadcn/ui installed.
6. The application window renders a static layout shell: sidebar column on the left, chat area in the center, 28px status bar strip at the bottom — matching the component tree in architecture.md §4.2 (static/unstyled is acceptable).
7. `cargo build --release` produces a binary without warnings that would block CI.
8. `npm run build` (inside `hermes-desktop/`) produces a Vite bundle without errors.
9. Design tokens from the PRD §7 (canvas `#0F0F11`, sidebar `#161618`, Nous Purple `#7C3AED`) are present in `src/styles/globals.css` as CSS custom properties.
10. App window dimensions: minimum 1024×768; title bar shows "Hermes Desktop".

## Tasks / Subtasks

- [ ] Initialize Tauri 2.x project (AC: 1, 2)
  - [ ] Run `cargo create-tauri-app` (or equivalent) in `hermes-desktop/` targeting Vite + React template
  - [ ] Rename/restructure generated directories to match architecture.md §7 exactly
  - [ ] Set `"identifier": "ai.pakele.hermes-desktop"` and `"title": "Hermes Desktop"` in `tauri.conf.json`
  - [ ] Set minimum window size 1024×768 in `tauri.conf.json`

- [ ] Configure Tauri plugins (AC: 3)
  - [ ] Add `@tauri-apps/plugin-dialog` v2.x to `Cargo.toml` and `package.json`
  - [ ] Add `@tauri-apps/plugin-fs` v2.x
  - [ ] Add `@tauri-apps/plugin-shell` v2.x
  - [ ] Add `@tauri-apps/plugin-store` v2.x
  - [ ] Register all four plugins in `src-tauri/src/main.rs` `.plugin(...)` chain

- [ ] Implement Rust command stubs (AC: 4)
  - [ ] Create `src-tauri/src/sessions.rs` — `list_sessions()` stub returning `Vec<SessionSummary>`, `get_session_messages()` stub
  - [ ] Create `src-tauri/src/config.rs` — `get_config()` and `save_config()` stubs
  - [ ] Create `src-tauri/src/projects.rs` — `list_projects()` and `add_project()` stubs
  - [ ] Create `src-tauri/src/fs.rs` — `read_dir()` stub returning `Vec<DirEntry>`
  - [ ] Create `src-tauri/src/gateway.rs` — `spawn_gateway()` and `kill_gateway()` stubs
  - [ ] Register all commands in `main.rs` via `.invoke_handler(tauri::generate_handler![...])`
  - [ ] Define minimal shared structs (`SessionSummary`, `DirEntry`, `Project`, `AppConfig`) with `serde::Serialize`

- [ ] Set up React + Vite + Tailwind + shadcn/ui (AC: 5)
  - [ ] Verify React 18 and Vite 5.x in `package.json`
  - [ ] Install and configure Tailwind CSS (PostCSS config, `tailwind.config.js`)
  - [ ] Install shadcn/ui CLI and init (`npx shadcn-ui@latest init`)
  - [ ] Create `src/styles/globals.css` with Tailwind directives and design token CSS custom properties

- [ ] Add design tokens to globals.css (AC: 9)
  - [ ] `--color-canvas: #0F0F11`
  - [ ] `--color-sidebar: #161618`
  - [ ] `--color-accent: #7C3AED` (Nous Purple)
  - [ ] `--font-ui: Inter, sans-serif`
  - [ ] `--font-mono: "JetBrains Mono", monospace`
  - [ ] Sidebar width token: `--sidebar-width: 260px`
  - [ ] Status bar height token: `--statusbar-height: 28px`

- [ ] Implement static layout shell in React (AC: 6)
  - [ ] Create `src/app.jsx` with top-level layout: sidebar (260px fixed), chat area (flex-grow), status bar (28px fixed bottom)
  - [ ] Create stub components: `src/components/sidebar.jsx`, `src/components/statusbar.jsx`, `src/components/message.jsx`, `src/components/toolcard.jsx`, `src/components/composer.jsx`, `src/components/markdown.jsx`
  - [ ] Create stub hooks directory: `src/hooks/useHermesGateway.js`, `src/hooks/useSessions.js`, `src/hooks/useFileTree.js`, `src/hooks/useProjects.js` (each exports a no-op hook)
  - [ ] Apply design tokens via Tailwind / CSS variables so window background is `#0F0F11`, sidebar is `#161618`

- [ ] Build verification (AC: 7, 8)
  - [ ] Confirm `cargo build --release` succeeds with zero errors
  - [ ] Confirm `npm run build` succeeds with zero errors

## Dev Notes

### Critical Architecture Constraints

- **Tauri version MUST be 2.x** — the plugin APIs (`plugin-dialog`, `plugin-fs`, `plugin-shell`, `plugin-store`) are 2.x only. Do not use Tauri 1.x APIs.
- **SQLite is NOT added in this story** — `sqlx` and the SQLite read logic belong in a future story (session listing). The `list_sessions` stub must return an empty vec, not query a DB.
- **WebSocket client is NOT added in this story** — `useHermesGateway` returns a no-op stub. The gateway connection belongs in a later story.
- **No global state library** — architecture.md §4.2 explicitly says "no global state library needed for Phase 1." Use React hooks only.
- **shadcn/ui + Tailwind** — these are the mandated component library per architecture.md §5. Do not introduce any other UI library (no MUI, no Chakra, no Ant Design).

### Project Structure Notes

Per architecture.md §7, the exact expected layout is:

```
hermes-desktop/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs
│       ├── sessions.rs
│       ├── config.rs
│       ├── projects.rs
│       ├── fs.rs
│       └── gateway.rs
└── src/
    ├── app.jsx
    ├── hooks/
    │   ├── useHermesGateway.js
    │   ├── useSessions.js
    │   ├── useFileTree.js
    │   └── useProjects.js
    ├── components/
    │   ├── sidebar.jsx
    │   ├── message.jsx
    │   ├── toolcard.jsx
    │   ├── composer.jsx
    │   ├── statusbar.jsx
    │   └── markdown.jsx
    └── styles/
        └── globals.css
```

All directories and files must exist at the end of this story (stubs are fine).

### Tech Stack Versions (from architecture.md §5)

| Technology | Required Version |
|---|---|
| Tauri | 2.x |
| React | 18 |
| Vite | 5.x |
| Tailwind | latest |
| shadcn/ui | latest |
| sqlx | 0.7 (NOT this story — future) |
| @tauri-apps/plugin-dialog | 2.x |
| @tauri-apps/plugin-fs | 2.x |
| @tauri-apps/plugin-shell | 2.x |
| @tauri-apps/plugin-store | 2.x |

### Design System Reference (PRD §7)

- Canvas background: `#0F0F11`
- Sidebar background: `#161618`
- Accent / Nous Purple: `#7C3AED`
- UI font: Inter
- Code/mono font: JetBrains Mono
- Sidebar width: 260px fixed
- Status bar height: 28px fixed
- Base grid: 4px

The app window itself must use `#0F0F11` as the background, and the sidebar panel must use `#161618`.

### Tauri Command Registration Pattern

All commands in `main.rs` must use the canonical pattern:

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            sessions::list_sessions,
            sessions::get_session_messages,
            config::get_config,
            config::save_config,
            projects::list_projects,
            projects::add_project,
            fs::read_dir,
            gateway::spawn_gateway,
            gateway::kill_gateway,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Each module file must have `pub use` on its command functions for this to compile.

### References

- [Source: docs/architecture.md#7-project-structure-tauri-app]
- [Source: docs/architecture.md#4-component-architecture]
- [Source: docs/architecture.md#5-tech-stack]
- [Source: docs/prd.md#7-design-system]
- [Source: docs/prd.md#8-non-functional-requirements]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
