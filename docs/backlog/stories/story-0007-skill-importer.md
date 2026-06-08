---
story_id: "STORY-0007"
title: "Skill Importer"
status: "PENDING_QA"
po_alignment: "APPROVED"
sm_reviewed: "2026-06-08"
created_at: "2026-06-08"
updated_at: "2026-06-08"
---

# Story 7.1: Skill Importer

Status: PENDING_QA

## Story

As a developer using Hermes Desktop,
I want to install `.skill` zip files via a file picker or drag-and-drop in the Settings panel,
so that I can add new Hermes capabilities without using the command line.

## Acceptance Criteria

1. **Rust dependency added**: `zip = "2"` present in `hermes-desktop/src-tauri/Cargo.toml` under `[dependencies]`. `cargo build --release` (with sysroot env from STORY-0001) passes with no new errors.

2. **New Rust file `src-tauri/src/skills.rs`**: Exports `#[derive(serde::Serialize, Clone)] pub struct SkillImportResult { pub name: String, pub trigger_phrases: Vec<String> }` and `#[tauri::command] pub fn import_skill(path: String) -> Result<SkillImportResult, String>`. Command registered in `main.rs` alongside existing commands.

3. **`import_skill` parses SKILL.md**: Opens the zip at `path`; finds the first entry whose filename (case-insensitive) equals `skill.md` or ends with `/skill.md`; reads its full content; extracts `name:` and `trigger_phrases:` (or `triggers:`) from the YAML frontmatter block (text between the first `---` pair). Returns `Err("No SKILL.md found in zip")` if absent, `Err("'name:' field not found in SKILL.md frontmatter")` if name is missing, and `Err(String)` for any I/O or zip parse failure.

4. **`import_skill` extracts zip**: Skips all entries whose path contains `__MACOSX`. For each remaining entry: **rejects any entry whose name contains `ParentDir` (`..`), `RootDir`, or `Prefix` path components** (zip-slip guard — checked via `Path::new(entry.name()).components()` BEFORE joining with `skill_dir`, because `PathBuf::starts_with` does not resolve `..` and a path like `myskill/../../.ssh/key` would falsely pass a starts_with check). Creates intermediate directories as needed. Copies file contents via `io::copy`. Returns `Ok(SkillImportResult { name, trigger_phrases })` after all entries are extracted.

5. **Settings panel "Skills" section** (`src/components/settings.jsx`): A new `<section>` at the bottom of the settings modal with heading "Skills". Contains a drag-drop zone `<div>` (styled with a dashed border, see Design Tokens below) and a "Browse .skill file" button. A result area below shows the last import outcome (or nothing on first open). The section is always visible — no toggle needed. **Placement:** insert this `<section>` after the `<div className="mt-6 flex justify-end gap-3">` button row, still inside `<Dialog.Content>` (i.e., it is the last element before `</Dialog.Content>`).

6. **File picker flow**: Clicking "Browse .skill file" calls `open({ multiple: false, filters: [{ name: 'Skill Files', extensions: ['skill'] }] })` from `@tauri-apps/plugin-dialog`, then calls `invoke('import_skill', { path })` with the returned path. If the user cancels the dialog (returns `null`), do nothing.

7. **Drag-drop flow**: A `useEffect` in `SettingsPanel` (active only while the settings modal is open) calls `listen('tauri://drag-drop', handler)` from `@tauri-apps/api/event`. The handler finds the first path ending with `.skill` in `event.payload.paths`. If found, calls `invoke('import_skill', { path })`. The `useEffect` cleanup calls the returned `unlisten()` function.

8. **Success result display**: After a successful `invoke('import_skill', ...)`, the result area shows:
   - Skill name in `font-mono text-accent font-semibold`
   - Bullet list of trigger phrases (each in `font-mono text-sm text-text`), or "(none found)" in `text-muted` if the list is empty
   - Yellow advisory box: `⚠ Restart gateway to activate skill` in `text-[13px] text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-3 py-2 mt-2`
   - The result area replaces any previous result each time import is triggered.

9. **Error result display**: If `invoke('import_skill', ...)` throws (i.e., the Rust command returned `Err`), the result area shows the error string in `text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2`.

10. **Drop zone visual feedback**: While a file is being dragged over the window (`tauri://drag-enter` event fires), set an `isDragging` state to `true`; on `tauri://drag-leave` or `tauri://drag-drop`, set it back to `false`. When `isDragging` is `true`, the drop zone border changes from `border-border` to `border-accent` and background from `bg-canvas` to `bg-accent/5`.

11. **Build verification**: `npm run build` passes. `cargo fmt --all --check` passes. `cargo build --release` passes with the `/tmp/hermes-sysroot` env.

## Tasks / Subtasks

- [x] Add `zip = "2"` to `src-tauri/Cargo.toml` (AC: #1)
- [x] Create `src-tauri/src/skills.rs` with `SkillImportResult` struct and `import_skill` command (AC: #2)
  - [x] Implement SKILL.md discovery and frontmatter parsing (AC: #3)
  - [x] Implement zip extraction with zip-slip guard (AC: #4)
- [x] Register `import_skill` in `src-tauri/src/main.rs` (AC: #2)
- [x] Add "Skills" section to `src/components/settings.jsx` (AC: #5)
  - [x] File picker button wiring (AC: #6)
  - [x] Drag-drop listener via `tauri://drag-drop` (AC: #7, #10)
  - [x] Success result display (AC: #8)
  - [x] Error result display (AC: #9)
- [x] Verify `npm run build`, `cargo fmt --all --check`, `cargo build --release` (AC: #11)

## Dev Notes

### Rust: `skills.rs` Implementation Pattern

```rust
use std::fs::{self, File};
use std::io;
use std::path::PathBuf;
use zip::ZipArchive;

#[derive(serde::Serialize, Clone)]
pub struct SkillImportResult {
    pub name: String,
    pub trigger_phrases: Vec<String>,
}

#[tauri::command]
pub fn import_skill(path: String) -> Result<SkillImportResult, String> {
    // Phase 1: parse SKILL.md
    let file = File::open(&path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    let skill_md = (0..archive.len()).find_map(|i| {
        let mut entry = archive.by_index(i).ok()?;
        let name_lower = entry.name().to_lowercase();
        if name_lower == "skill.md" || name_lower.ends_with("/skill.md") {
            let mut buf = String::new();
            io::Read::read_to_string(&mut entry, &mut buf).ok()?;
            Some(buf)
        } else {
            None
        }
    }).ok_or("No SKILL.md found in zip")?;

    let (name, trigger_phrases) = parse_frontmatter(&skill_md)?;

    // Phase 2: extract all entries
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let skill_dir = home.join(".hermes").join("skills").join(&name);
    fs::create_dir_all(&skill_dir).map_err(|e| e.to_string())?;

    let file2 = File::open(&path).map_err(|e| e.to_string())?;
    let mut archive2 = ZipArchive::new(file2).map_err(|e| e.to_string())?;

    for i in 0..archive2.len() {
        let mut entry = archive2.by_index(i).map_err(|e| e.to_string())?;
        if entry.name().contains("__MACOSX") {
            continue;
        }
        // Zip-slip guard: reject entries with ".." or absolute path components BEFORE joining.
        // NOTE: PathBuf::starts_with is component-wise — it does NOT resolve "..".
        // A path like "skill/../../../etc/passwd" would pass a starts_with check because
        // the first component matches. Checking entry.name() components directly is correct.
        use std::path::Component;
        if std::path::Path::new(entry.name()).components().any(|c| {
            matches!(c, Component::ParentDir | Component::RootDir | Component::Prefix(_))
        }) {
            return Err(format!("Zip-slip rejected: {}", entry.name()));
        }
        let dest: PathBuf = skill_dir.join(entry.name());
        if entry.is_dir() {
            fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut out = File::create(&dest).map_err(|e| e.to_string())?;
            io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
        }
    }

    Ok(SkillImportResult { name, trigger_phrases })
}

fn parse_frontmatter(content: &str) -> Result<(String, Vec<String>), String> {
    let start = content.find("---").ok_or("No frontmatter found in SKILL.md")?;
    let rest = &content[start + 3..];
    let end = rest.find("---").ok_or("Frontmatter not closed in SKILL.md")?;
    let fm = &rest[..end];

    let name = fm.lines()
        .find_map(|line| {
            let l = line.trim();
            if l.starts_with("name:") {
                let v = l["name:".len()..].trim().trim_matches('"').trim_matches('\'');
                if !v.is_empty() { Some(v.to_string()) } else { None }
            } else { None }
        })
        .ok_or("'name:' field not found in SKILL.md frontmatter")?;

    let mut triggers = Vec::new();
    let mut in_list = false;
    for line in fm.lines() {
        let l = line.trim();
        if l.starts_with("trigger_phrases:") || l.starts_with("triggers:") {
            in_list = true;
            continue;
        }
        if in_list {
            if let Some(item) = l.strip_prefix("- ") {
                triggers.push(item.trim().to_string());
            } else if !l.is_empty() && !l.starts_with('#') {
                in_list = false;
            }
        }
    }

    Ok((name, triggers))
}
```

### Cargo.toml: `dirs` is already a dependency

`dirs` was added in STORY-0002 (`config.rs` uses `dirs::home_dir()` for `~/.config/hermes-desktop/config.json`) and in STORY-0004 (`sessions.rs` uses it for `~/.hermes/state.db`). Do NOT add it again — just add `zip = "2"`.

### `main.rs` command registration

Add `skills::import_skill` to the `.invoke_handler(tauri::generate_handler![...])` list alongside existing commands. Add `mod skills;` at the top of `main.rs`.

Pattern from existing `main.rs`:
```rust
mod sessions;
mod config;
mod projects;
mod fs;
mod gateway;
mod skills;   // NEW

// in main():
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        sessions::list_sessions,
        // ... existing commands ...
        skills::import_skill,  // NEW
    ])
```

### `@tauri-apps/plugin-dialog` already installed

`@tauri-apps/plugin-dialog` was added in STORY-0005 for the project folder picker (`open({ directory: true })`). Verify it is present in `hermes-desktop/package.json`. If `dialog.open({ filters: [...] })` API is not yet used (project picker only used `directory: true`), no new install is needed — the plugin handles both.

Also verify `hermes-desktop/src-tauri/capabilities/default.json` already includes `"dialog:default"`. If absent, add it (the plugin requires this capability entry in Tauri 2.x).

### Frontend: Tauri drag-drop events

Browser-native `ondrop` events do NOT provide file paths in Tauri WebView. Use Tauri's window-level events instead:

```js
import { listen } from '@tauri-apps/api/event';

// In SettingsPanel useEffect (runs when modal opens):
useEffect(() => {
  if (!open) return; // 'open' = modal visibility prop

  let unlistenDrop, unlistenEnter, unlistenLeave;

  Promise.all([
    listen('tauri://drag-drop', (e) => {
      setIsDragging(false);
      const skillPath = e.payload.paths?.find(p => p.endsWith('.skill'));
      if (skillPath) doImport(skillPath);
    }),
    listen('tauri://drag-enter', () => setIsDragging(true)),
    listen('tauri://drag-leave', () => setIsDragging(false)),
  ]).then(([a, b, c]) => {
    unlistenDrop = a; unlistenEnter = b; unlistenLeave = c;
  });

  return () => {
    unlistenDrop?.(); unlistenEnter?.(); unlistenLeave?.();
  };
}, [open]);
```

The `open` prop is already passed to `SettingsPanel` in `app.jsx` as `isSettingsOpen`. The existing `SettingsPanel` component signature: `({ open, onClose })` — use `open` as the guard.

### Frontend: `doImport` helper in SettingsPanel

```js
const doImport = async (path) => {
  setImportState({ status: 'loading', name: '', triggerPhrases: [], error: '' });
  try {
    const result = await invoke('import_skill', { path });
    setImportState({ status: 'success', name: result.name, triggerPhrases: result.trigger_phrases, error: '' });
  } catch (err) {
    setImportState({ status: 'error', name: '', triggerPhrases: [], error: String(err) });
  }
};
```

Initial `importState`: `{ status: 'idle', name: '', triggerPhrases: [], error: '' }`.

### Frontend: File picker wiring

```js
import { open } from '@tauri-apps/plugin-dialog';

const handleBrowse = async () => {
  const path = await open({
    multiple: false,
    filters: [{ name: 'Skill Files', extensions: ['skill'] }],
  });
  if (path) doImport(path);
};
```

### Design Tokens for Skills Section

```
Heading:          text-xs font-semibold uppercase tracking-widest text-muted mb-3
Drop zone idle:   rounded-xl border border-dashed border-border bg-canvas p-6 text-center text-muted text-sm
Drop zone active: border-accent bg-accent/5
Browse button:    `variant="outline"` (matches the Cancel button in settings — secondary visual prominence)
Success name:     font-mono text-accent font-semibold text-sm
Success trigger:  font-mono text-sm text-text
Restart notice:   text-[13px] text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-3 py-2 mt-2
Error:            text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2
```

Drop zone text when idle: `Drop a .skill file here or use the button below`.

### Zip-Slip Security Note

**CRITICAL:** Do NOT use `PathBuf::starts_with()` to guard against zip-slip. `starts_with` is component-wise and does NOT resolve `..` — a path like `/home/user/.hermes/skills/myskill/../../.ssh/authorized_keys` has `myskill` as its 6th component and therefore PASSES a `starts_with(skill_dir)` check, even though it escapes the directory when the OS resolves `..`.

The correct guard (already shown in the Rust snippet above) is to inspect `entry.name()` components **before** joining with `skill_dir`:

```rust
use std::path::Component;
if std::path::Path::new(entry.name()).components().any(|c| {
    matches!(c, Component::ParentDir | Component::RootDir | Component::Prefix(_))
}) {
    return Err(format!("Zip-slip rejected: {}", entry.name()));
}
let dest = skill_dir.join(entry.name()); // safe: no traversal components
```

After this check, `skill_dir.join(entry.name())` is guaranteed to remain under `skill_dir`.

### Gateway Hot-Reload Note

Hermes has no `reload.skills` RPC. New skills are only active after the next gateway restart. The UI MUST display the `⚠ Restart gateway to activate skill` advisory after every successful import — do not omit it or make it dismissible in Phase 1.

[Source: docs/architecture.md#4.3-skill-importer]
[Source: docs/prd.md#6.8-skill-importer]

### What NOT to do

- Do NOT use Python sidecar for extraction — Rust handles this cleanly with the `zip` crate.
- Do NOT call `reload.mcp` or any gateway RPC after import — Hermes has no skill hot-reload.
- Do NOT extract files outside `~/.hermes/skills/<name>/` even if the zip entry paths suggest it.
- Do NOT add `serde_yaml` as a dependency — the manual frontmatter parser covers all real-world SKILL.md formats.

### No Changes to Existing Hooks or Chat Components

This story touches only:
- `src-tauri/Cargo.toml` (add `zip = "2"`)
- `src-tauri/src/skills.rs` (new)
- `src-tauri/src/main.rs` (add `mod skills;` and register command)
- `src/components/settings.jsx` (add Skills section)

Do NOT modify `useHermesGateway.js`, `app.jsx`, `sidebar.jsx`, or any other component.

### Previous Story Context

- **STORY-0001**: `cargo build --release` requires the `/tmp/hermes-sysroot` env documented in that story. No change to that flow.
- **STORY-0002**: `settings.jsx` currently has hermes binary path, gateway URL, auto-start toggle, and a save button. Add the Skills section below the save button, inside the same modal dialog. Match heading style used for the existing settings fields.
- **STORY-0005**: `@tauri-apps/plugin-dialog` was already added for the project folder picker. The `open()` call used there was `open({ directory: true })` — for skill import use `open({ multiple: false, filters: [...] })`.

### References

- Skill importer architecture: [Source: docs/architecture.md#4.3-skill-importer]
- PRD requirements I1-I4: [Source: docs/prd.md#6.8-skill-importer]
- Tech stack (dialog plugin): [Source: docs/architecture.md#5-tech-stack]
- Gateway lifecycle (no reload.skills): [Source: docs/architecture.md#9-resolved-open-questions Q5]
- Design tokens: [Source: hermes-desktop/src/styles/globals.css]

## PO Alignment

2026-06-08 PO APPROVED: All 8 criteria passed. Maps to PRD §6.8 I1-I4 and Success Criterion #4. Architecture-consistent: correct Tauri command/dialog/event patterns, correct `~/.hermes/skills/<name>/` destination, no `reload.skills` RPC per arch §9 Q5. 11 numbered testable ACs with exact error strings, CSS classes, and component signatures. Scope bounded to 4 files. All upstream dependencies (STORY-0001 sysroot env, STORY-0002 settings.jsx base, STORY-0004 dirs crate, STORY-0005 plugin-dialog) are COMPLETE. Security concern (zip-slip) explicitly addressed with correct Component-based guard. No duplicate scope with any prior story.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `cargo fmt --all`
- `npm run build`
- `cargo fmt --all --check`
- `PKG_CONFIG_PATH=/tmp/hermes-sysroot/root/usr/lib/x86_64-linux-gnu/pkgconfig:/tmp/hermes-sysroot/root/usr/share/pkgconfig PKG_CONFIG_SYSROOT_DIR=/tmp/hermes-sysroot/root LD_LIBRARY_PATH=/tmp/hermes-sysroot/root/usr/lib/x86_64-linux-gnu:/tmp/hermes-sysroot/root/lib/x86_64-linux-gnu LIBRARY_PATH=/tmp/hermes-sysroot/root/usr/lib/x86_64-linux-gnu:/tmp/hermes-sysroot/root/lib/x86_64-linux-gnu CPATH=/tmp/hermes-sysroot/root/usr/include:/tmp/hermes-sysroot/root/usr/include/x86_64-linux-gnu cargo build --release`

## Implementation Notes

- Files changed: `hermes-desktop/src-tauri/Cargo.toml`, `hermes-desktop/src-tauri/Cargo.lock`, `hermes-desktop/src-tauri/src/skills.rs`, `hermes-desktop/src-tauri/src/main.rs`, `hermes-desktop/src/components/settings.jsx`.
- Approach: added a Rust Tauri command that reads `SKILL.md` from the `.skill` zip, parses frontmatter manually for `name` and trigger fields, then re-opens the archive to extract entries into `~/.hermes/skills/<name>/` while rejecting traversal components before any path join.
- Key decisions: kept parsing dependency-free instead of adding `serde_yaml`; preserved the existing settings modal and attached Tauri drag-drop listeners only while it is open; reused the STORY-0001 `/tmp/hermes-sysroot/root` verification environment rather than committing any host-specific build workaround.

### Completion Notes List

- Added `import_skill` to the Tauri backend and registered it in `main.rs`.
- Implemented SKILL frontmatter parsing, `__MACOSX` skipping, and component-based zip-slip rejection in the new `skills.rs`.
- Extended the Settings modal with a persistent Skills section, `.skill` file picker flow, drag-drop import flow, active drop-zone styling, and success/error result rendering with the restart advisory.
- Verified `npm run build`, `cargo fmt --all --check`, and `cargo build --release` with the documented sysroot environment.

### File List

- `hermes-desktop/src-tauri/Cargo.toml`
- `hermes-desktop/src-tauri/Cargo.lock`
- `hermes-desktop/src-tauri/src/skills.rs`
- `hermes-desktop/src-tauri/src/main.rs`
- `hermes-desktop/src/components/settings.jsx`
