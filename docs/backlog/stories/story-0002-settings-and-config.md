---
story_id: "STORY-0002"
title: "Settings Panel & App Config Persistence"
status: "COMPLETED"
qa_status: "PASS"
po_alignment: "APPROVED"
created_at: "2026-06-08"
updated_at: "2026-06-08"
epic: "infrastructure"
depends_on: ["STORY-0001"]
---

# Story 0002: Settings Panel & App Config Persistence

Status: PENDING_QA

## Story

As a Linux developer using Hermes Desktop,
I want a settings panel where I can configure the Hermes binary path, gateway URL, and startup behavior,
so that the app knows how to connect to my local Hermes instance and persists those preferences across restarts.

## Acceptance Criteria

1. A gear icon in the status bar opens a settings panel (modal or slide-over) when clicked.
2. The settings panel displays four fields: **Hermes binary path** (text input), **Gateway URL** (text input), **Auto-start gateway on launch** (toggle/checkbox), and **Active project path** (text input).
3. On first launch (no config file exists), `get_config` returns safe defaults: `hermes_bin` auto-detected from `$PATH` (empty string if not found), `gateway_url` = `"ws://localhost:8765"`, `auto_start_gateway` = `false`, `active_project` = `""`.
4. `get_config` reads `~/.config/hermes-desktop/config.json` when it exists and returns the stored values.
5. Clicking **Save** in the panel calls `save_config`, writes the values to `~/.config/hermes-desktop/config.json` (creating the directory if absent), and closes the panel.
6. Clicking **Cancel** closes the panel without writing to disk; all unsaved changes are discarded.
7. After saving, `useAppConfig` returns the updated config values so any component reading them gets fresh data.
8. `cargo build --release` and `npm run build` both pass with the new implementation in place.

## Tasks / Subtasks

- [x] Implement `get_config` Rust command (AC: 3, 4)
  - [x] Resolve config path: `$HOME/.config/hermes-desktop/config.json` using `std::env::var("HOME")` or Tauri's `app_handle.path().config_dir()`
  - [x] If file does not exist, return `AppConfig` defaults: auto-detect `hermes_bin` via `which hermes` (`Command::new("which").arg("hermes")`), use `"ws://localhost:8765"` for `gateway_url`, `false` for `auto_start_gateway`, `""` for `active_project`
  - [x] If file exists, parse JSON with `serde_json::from_str` into `AppConfig`; return deserialization errors as `Err(String)`
  - [x] Return type: `Result<AppConfig, String>` (Tauri command error type must be `serde::Serialize`)

- [x] Implement `save_config` Rust command (AC: 5)
  - [x] Resolve config directory: `$HOME/.config/hermes-desktop/`
  - [x] Create directory recursively with `std::fs::create_dir_all` if missing
  - [x] Serialize `AppConfig` to pretty JSON with `serde_json::to_string_pretty`
  - [x] Write to `config.json` with `std::fs::write`
  - [x] Return type: `Result<(), String>`

- [x] Update `AppConfig` struct in `config.rs` (AC: 3, 4, 5)
  - [x] Fields: `hermes_bin: String`, `gateway_url: String`, `auto_start_gateway: bool`, `active_project: String`
  - [x] Derive `serde::Deserialize` in addition to existing `serde::Serialize`
  - [x] Add `#[serde(default)]` on struct so missing JSON fields fall back to `Default::default()`
  - [x] Implement `Default` trait with the specified defaults (`gateway_url = "ws://localhost:8765"`, `auto_start_gateway = false`, others empty)

- [x] Wire `useAppConfig` hook to real Tauri commands (AC: 4, 7)
  - [x] On mount, call `invoke('get_config')` and store result in state
  - [x] Expose `saveConfig(config)` function that calls `invoke('save_config', { config })` and updates local state on success
  - [x] Expose `{ config, saveConfig, loading, error }` — callers should not call invoke directly

- [x] Create `src/components/settings.jsx` (AC: 1, 2, 5, 6)
  - [x] Modal/sheet component (shadcn `<Dialog>` or `<Sheet>`) opened by a boolean `open` prop
  - [x] Local form state initialized from `useAppConfig().config` when the panel opens; guard against `config === null` (still loading) — initialize with `config ?? {}` and disable Save until `!loading && config !== null`
  - [x] Four form fields matching AC2 (labels and placeholders per PRD §6.7 T2–T5)
  - [x] **Save** button: calls `saveConfig(formState)`; on success call `onClose()`; on error display error string inside the panel (red text above Save button) and do NOT close — user must see what failed
  - [x] **Cancel** button: calls `onClose()` without saving; local form state is discarded
  - [x] No third-party form library — plain React controlled inputs

- [x] Wire gear icon in `StatusBar` to settings panel (AC: 1)
  - [x] Add `open` state and `setOpen` to `app.jsx` (NOT StatusBar — StatusBar is a display component with no state); pass `onSettingsOpen={() => setOpen(true)}` as a prop to `<StatusBar>`
  - [x] Gear icon (use `<Settings />` icon from `lucide-react`, already available via shadcn — no new dependency) in `src/components/statusbar.jsx` calls `onSettingsOpen` prop when clicked
  - [x] `<SettingsPanel open={open} onClose={() => setOpen(false)} />` rendered at root of `app.jsx` (rename import to `SettingsPanel` to avoid shadowing `lucide-react`'s `Settings` icon)

- [x] Verify builds (AC: 8)
  - [x] `npm run build` passes with zero errors in `hermes-desktop/`
  - [x] `cargo build --release` passes (or reaches the same GTK/WebKit env barrier documented in STORY-0001 — no new Rust errors introduced)

## Dev Notes

### Critical: AppConfig Struct Must Match Architecture §4.1 Exactly

The `AppConfig` struct in `config.rs` is the contract used by every downstream story (gateway lifecycle, project switcher, session list). Use these exact field names — nothing else:

```rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
pub struct AppConfig {
    #[serde(default)]
    pub hermes_bin: String,
    #[serde(default = "default_gateway_url")]
    pub gateway_url: String,
    #[serde(default)]
    pub auto_start_gateway: bool,
    #[serde(default)]
    pub active_project: String,
}

fn default_gateway_url() -> String {
    "ws://localhost:8765".to_string()
}
```

Do NOT rename fields, add extra fields, or nest sub-structs. This struct is the interface boundary.

### Tauri Command Signatures

Both commands must follow Tauri 2.x error conventions (error type must implement `serde::Serialize`):

```rust
#[tauri::command]
pub async fn get_config(app_handle: tauri::AppHandle) -> Result<AppConfig, String> { ... }

#[tauri::command]
pub async fn save_config(config: AppConfig) -> Result<(), String> { ... }
```

Errors should be surfaced as `Err(e.to_string())` so the frontend receives a serializable error string.

### Config File Path Resolution

Use `std::env::var("HOME")` for robustness (works in WSL2 and standard Linux):

```rust
let config_dir = std::env::var("HOME")
    .map(|h| std::path::PathBuf::from(h).join(".config").join("hermes-desktop"))
    .map_err(|e| e.to_string())?;
let config_path = config_dir.join("config.json");
```

Alternatively, use `tauri::path::BaseDirectory` with `app_handle.path().config_dir()` — either approach is fine, but the resolved path MUST be `~/.config/hermes-desktop/config.json`.

### Auto-Detecting Hermes Binary

When no config file exists, attempt to find `hermes` in PATH:

```rust
let hermes_bin = std::process::Command::new("which")
    .arg("hermes")
    .output()
    .ok()
    .and_then(|o| if o.status.success() {
        String::from_utf8(o.stdout).ok().map(|s| s.trim().to_string())
    } else {
        None
    })
    .unwrap_or_default();
```

Return empty string if not found — the user sets it manually in the settings panel.

### Do NOT Use `plugin-store` for App Config

`@tauri-apps/plugin-store` (installed in STORY-0001) is available but is NOT the right tool for the main app config. Architecture §4.1 specifies a plain JSON file at `~/.config/hermes-desktop/config.json` managed by the Rust backend. Use `serde_json` + `std::fs` for this, not the plugin-store API. Plugin-store may be used for UI state in future stories.

### Frontend Hook Pattern

`useAppConfig.js` must be the single source of truth for config in the frontend. Components should NOT call `invoke('get_config')` directly:

```js
// src/hooks/useAppConfig.js
import { invoke } from '@tauri-apps/api/core';
import { useState, useEffect } from 'react';

export function useAppConfig() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    invoke('get_config')
      .then(setConfig)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const saveConfig = async (newConfig) => {
    await invoke('save_config', { config: newConfig });
    setConfig(newConfig);
  };

  return { config, saveConfig, loading, error };
}
```

### Settings Panel: shadcn Component Selection

Use `<Dialog>` from shadcn/ui for the settings modal — it is the simplest pattern and `Dialog` is already available via shadcn. Do NOT introduce a new UI library. If shadcn `<Dialog>` is not yet installed, install it with:

```bash
npx shadcn@latest add dialog
```

The `cn()` utility from `src/lib/utils.js` (installed by STORY-0001 scaffold) is available for conditional class names.

### No External Form Library

Use plain React controlled inputs for the settings form. `useState` with a local `formState` object is sufficient:

```jsx
const [form, setForm] = useState({ ...config });
const handleChange = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
```

Do NOT install react-hook-form, formik, or any other form library.

### Settings Panel: Null-Safety and Save Error Handling

`useAppConfig()` initializes `config = null` until the Tauri invoke resolves. If the panel opens before resolution, `useState({ ...config })` spreads null and crashes. Use:

```jsx
// Safe initialization — config is null until loaded
const [form, setForm] = useState(config ?? {});
const [saveError, setSaveError] = useState(null);

const handleSave = async () => {
  setSaveError(null);
  try {
    await saveConfig(form);
    onClose();
  } catch (e) {
    setSaveError(String(e)); // Show error in panel, do NOT close
  }
};
```

Disable Save while loading:
```jsx
<button disabled={loading || !config} onClick={handleSave}>Save</button>
{saveError && <p className="text-red-500 text-sm mt-1">{saveError}</p>}
```

In practice the gear icon appears after app mount so config should already be loaded, but the null guard prevents a crash on slow systems.

### Serde Dependency in Cargo.toml

Check `src-tauri/Cargo.toml` from the STORY-0001 scaffold first — `serde_json` may already be present. Add only if absent:

```toml
[dependencies]
serde_json = "1"
serde = { version = "1", features = ["derive"] }
```

### Project Structure Notes

- Alignment with architecture.md §7: `config.rs` already exists (stub). Replace stub implementation in-place.
- New file: `src/components/settings.jsx` — add to existing `components/` directory.
- `src/hooks/useAppConfig.js` already exists (stub) — replace no-op with real implementation in-place.
- Do NOT create additional files or modules — all config logic stays in `config.rs`.

### References

- [Source: docs/architecture.md#41-tauri-backend-rust] — AppConfig struct, command signatures, file path
- [Source: docs/architecture.md#5-tech-stack] — serde/sqlx versions
- [Source: docs/prd.md#67-settings] — T1–T6 requirements and priorities
- [Source: docs/backlog/stories/story-0001-tauri-app-scaffold.md#dev-notes] — existing scaffold files (config.rs stub, useAppConfig.js stub, plugin-store registration)

## PO Alignment

2026-06-08 PO APPROVED: All 8 criteria passed. (1) PRD-mapped: covers all §6.7 settings requirements T1–T6. (2) Architecture-consistent: AppConfig struct, command signatures, config path, and useAppConfig hook pattern match §4.1 and §4.2 exactly; plugin-store exclusion explicitly documented. (3) Requirements unambiguous: code snippets provided for every non-trivial implementation detail. (4) 8 ACs are numbered, specific, and independently testable including null-safety guard, save-error handling, and build verification. (5) Scope right-sized for one focused dev session. (6) Dependency STORY-0001 is COMPLETED. (7) No duplicate scope: STORY-0001 created stubs, this story replaces them with real implementation. status→READY_FOR_DEV.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm run build`
- `cargo fmt --all --check`
- `cargo build --release`

### Completion Notes List

- Implemented real Rust-backed app config persistence at `~/.config/hermes-desktop/config.json`, including default fallback behavior and Hermes binary auto-detection when no file exists.
- Replaced the placeholder `useAppConfig` hook with a shared frontend config store so all hook consumers receive refreshed config state after `save_config`.
- Added a modal settings panel and status-bar gear action with null-safe form initialization, cancel semantics, and inline save error handling.
- Verified `npm run build` passes. `cargo build --release` still stops at the previously documented host GTK/WebKit pkg-config dependency barrier before app-code compilation, matching STORY-0001's environment limitation.

## Implementation Notes

### Files Changed

- `hermes-desktop/src-tauri/src/config.rs`
- `hermes-desktop/src/hooks/useAppConfig.js`
- `hermes-desktop/src/components/settings.jsx`
- `hermes-desktop/src/components/statusbar.jsx`
- `hermes-desktop/src/app.jsx`

### Approach

- Kept all app-config persistence in the existing Rust `config.rs` module, using `serde_json` and `std::fs` to match the architecture contract instead of the store plugin.
- Implemented `useAppConfig` as a small shared module-level store so multiple components can read the same config snapshot and observe updates after saves without adding a global state library.
- Added the settings UI as a single dialog component with local form state that rehydrates from shared config on open and discards unsaved edits on close.

### Key Decisions

- Used `$HOME/.config/hermes-desktop/config.json` directly for deterministic Linux path resolution and parity with the story dev notes.
- Preserved safe default deserialization with struct-level and field-level serde defaults so future config schema additions remain backward compatible.
- Treated the Rust build acceptance criterion as satisfied when it hit the same native dependency blocker already accepted in STORY-0001, since no new repo-level Rust errors surfaced before that environment failure.

### File List

- `docs/backlog/stories/story-0002-settings-and-config.md`
- `hermes-desktop/src-tauri/src/config.rs`
- `hermes-desktop/src/hooks/useAppConfig.js`
- `hermes-desktop/src/components/settings.jsx`
- `hermes-desktop/src/components/statusbar.jsx`
- `hermes-desktop/src/app.jsx`

## QA Notes

**QA Agent:** claude-sonnet-4-6 | **Date:** 2026-06-08 | **Result:** PASS

### Checks Performed

1. **Static code review** — Read all 5 implementation files and verified against story ACs, architecture §4.1, and PRD §6.7.
2. **Build verification** — `npm run build` executed: 1793 modules, zero errors, 2.29s. `cargo fmt --all --check`: clean. `cargo check`/`cargo build --release`: blocked at the same documented host GTK/WebKit native-library barrier (gobject-2.0, glib-2.0) established in STORY-0001 — no new Rust compilation errors introduced before the environment gate.

### AC Verification

| AC | Description | Result |
|----|-------------|--------|
| AC1 | Gear icon opens settings panel | PASS — `statusbar.jsx` `Settings` icon calls `onSettingsOpen` prop; `app.jsx` wires `setSettingsOpen(true)` and renders `<SettingsPanel>` at root |
| AC2 | Four fields present in panel | PASS — `settings.jsx` has `hermes_bin` (text), `gateway_url` (text), `active_project` (text), `auto_start_gateway` (checkbox) |
| AC3 | First-launch defaults | PASS — `config.rs:62-68` returns `AppConfig { hermes_bin: detect_hermes_bin(), ..Default::default() }` with `gateway_url="ws://localhost:8765"`, `auto_start_gateway=false`, `active_project=""` |
| AC4 | Reads config file when present | PASS — `config.rs:70-72` reads `$HOME/.config/hermes-desktop/config.json` and parses JSON with `serde_json` |
| AC5 | Save writes to disk and closes panel | PASS — `config.rs:75-82` creates dir with `create_dir_all`, writes pretty JSON; `settings.jsx:36-44` calls `saveConfig` then `onClose()` |
| AC6 | Cancel discards changes | PASS — `settings.jsx:138` Cancel calls `onClose()` only; form re-initializes from `config` on next open via `useEffect` |
| AC7 | Hook returns updated values after save | PASS — `useAppConfig.js:63-67` module-level store updates `state.config` and calls `emit()` to all registered listeners |
| AC8 | Builds pass | PASS — `npm run build` clean; Rust blocked at documented env barrier only, no new source errors |

### Code Quality

- `AppConfig` struct matches architecture §4.1 exactly (field names, derives, serde defaults, `default_gateway_url` fn).
- Tauri command signatures match spec (`Result<AppConfig, String>`, `Result<(), String>`).
- `useAppConfig` module-level store pattern avoids duplicate `invoke` calls and propagates updates to all consumers.
- `settings.jsx` null-safe form initialization (`config ?? EMPTY_CONFIG`), save disabled while loading, inline save error display without panel close.
- No external form library used. `radix-ui` Dialog used directly (v1.5.0 meta-package, confirmed working via build).
- No dead code. No regressions against STORY-0001 scaffold.

### Residual Risks

- Minor: `useAppConfig.saveConfig` updates `state.config` optimistically without re-fetching from disk. If `save_config` Rust command succeeds but the written file differs from what was passed (e.g., serialization transforms), the in-memory state would be stale until the next app launch. This is low-risk given the simple JSON schema.
- The `visibleError` in `settings.jsx` merges initial load errors with save errors — a pre-existing load failure will remain visible even after the user starts editing. Acceptable for the current scope.

### Pass Confidence: HIGH
