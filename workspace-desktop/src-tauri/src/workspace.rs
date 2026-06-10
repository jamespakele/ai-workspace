use serde::Serialize;
use std::path::{Path, PathBuf};

/// Resolved workspace context ready to inject into an agent prompt.
#[derive(Clone, Default, Serialize)]
pub struct WorkspaceContext {
    /// Contents of soul.md (philosophy, voice, values). Always loaded.
    pub soul: String,
    /// Contents of os.md (methods, frameworks, rules). Always loaded.
    /// Project-level os.md overrides the global one.
    pub os: String,
    /// Skill names available in this workspace scope.
    pub available_skills: Vec<SkillInfo>,
}

#[derive(Clone, Serialize)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub path: String,
    pub is_symlink: bool,
}

/// The global workspace root: ~/.workspace
fn global_root() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join(".workspace")
}

/// The project-scoped workspace: <project_dir>/.workspace
fn project_root(project_dir: &str) -> PathBuf {
    Path::new(project_dir).join(".workspace")
}

/// Load the workspace context for a given project directory.
/// Merges global + project-level context with project taking priority.
#[tauri::command]
pub fn load_workspace(project_dir: Option<String>) -> WorkspaceContext {
    let global = global_root();

    // soul.md — global only (you don't change who you are per project).
    let soul = read_file_or_empty(&global.join("soul.md"));

    // os.md — project overrides global.
    let os = if let Some(dir) = &project_dir {
        let project_os = project_root(dir).join("os.md");
        if project_os.exists() {
            read_file_or_empty(&project_os)
        } else {
            read_file_or_empty(&global.join("os.md"))
        }
    } else {
        read_file_or_empty(&global.join("os.md"))
    };

    // Skills — merge global + project symlinks, project wins on conflict.
    let mut skills = Vec::new();
    collect_skills(&global.join("skills"), &mut skills);
    if let Some(dir) = &project_dir {
        collect_skills(&project_root(dir).join("skills"), &mut skills);
    }

    // Deduplicate by name (project-scoped wins).
    skills.dedup_by(|a, b| a.name == b.name);

    WorkspaceContext {
        soul,
        os,
        available_skills: skills,
    }
}

/// Initialize a fresh global workspace with template soul.md and os.md.
#[tauri::command]
pub fn init_workspace() -> Result<String, String> {
    let root = global_root();
    let skills_dir = root.join("skills");
    let plugins_dir = root.join("plugins");

    std::fs::create_dir_all(&skills_dir)
        .map_err(|e| format!("Failed to create skills dir: {e}"))?;
    std::fs::create_dir_all(&plugins_dir)
        .map_err(|e| format!("Failed to create plugins dir: {e}"))?;

    let soul_path = root.join("soul.md");
    if !soul_path.exists() {
        std::fs::write(&soul_path, SOUL_TEMPLATE)
            .map_err(|e| format!("Failed to write soul.md: {e}"))?;
    }

    let os_path = root.join("os.md");
    if !os_path.exists() {
        std::fs::write(&os_path, OS_TEMPLATE)
            .map_err(|e| format!("Failed to write os.md: {e}"))?;
    }

    Ok(root.to_string_lossy().to_string())
}

/// Scope a skill to a project by creating a symlink.
#[tauri::command]
pub fn scope_skill_to_project(
    skill_name: String,
    project_dir: String,
) -> Result<(), String> {
    let global_skill = global_root().join("skills").join(&skill_name);
    if !global_skill.exists() {
        return Err(format!("Skill '{skill_name}' not found in global workspace"));
    }

    let project_skills = project_root(&project_dir).join("skills");
    std::fs::create_dir_all(&project_skills)
        .map_err(|e| format!("Failed to create project skills dir: {e}"))?;

    let link_path = project_skills.join(&skill_name);
    if link_path.exists() {
        return Ok(()); // Already scoped.
    }

    #[cfg(unix)]
    std::os::unix::fs::symlink(&global_skill, &link_path)
        .map_err(|e| format!("Failed to create symlink: {e}"))?;

    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(&global_skill, &link_path)
        .map_err(|e| format!("Failed to create symlink: {e}"))?;

    Ok(())
}

/// Remove a skill symlink from a project.
#[tauri::command]
pub fn unscope_skill_from_project(
    skill_name: String,
    project_dir: String,
) -> Result<(), String> {
    let link_path = project_root(&project_dir).join("skills").join(&skill_name);
    if link_path.exists() {
        std::fs::remove_file(&link_path)
            .or_else(|_| std::fs::remove_dir_all(&link_path))
            .map_err(|e| format!("Failed to remove skill link: {e}"))?;
    }
    Ok(())
}

/// List all globally installed skills (in ~/.workspace/skills/).
#[tauri::command]
pub fn list_global_skills() -> Vec<SkillInfo> {
    let mut skills = Vec::new();
    collect_skills(&global_root().join("skills"), &mut skills);
    skills
}

/// List skills scoped to a project (symlinks in <project>/.workspace/skills/).
#[tauri::command]
pub fn list_project_skills(project_dir: String) -> Vec<SkillInfo> {
    let mut skills = Vec::new();
    collect_skills(&project_root(&project_dir).join("skills"), &mut skills);
    skills
}

/// Install a packaged skill or plugin from a .skill or .plugin zip file.
/// .skill files are extracted to ~/.workspace/skills/<package-name>/
/// .plugin files are extracted to ~/.workspace/plugins/<package-name>/
#[tauri::command]
pub fn install_skill_package(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {file_path}"));
    }

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let target_parent = match ext.as_str() {
        "skill" => global_root().join("skills"),
        "plugin" => global_root().join("plugins"),
        _ => return Err("Unsupported file type. Use .skill or .plugin files.".to_string()),
    };

    std::fs::create_dir_all(&target_parent)
        .map_err(|e| format!("Failed to create target dir: {e}"))?;

    // Derive the package name from the filename (strip extension).
    let package_name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    let target_dir = target_parent.join(&package_name);

    // If already installed, remove first (upgrade).
    if target_dir.exists() {
        std::fs::remove_dir_all(&target_dir)
            .map_err(|e| format!("Failed to remove existing package: {e}"))?;
    }

    std::fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create package dir: {e}"))?;

    // Open the zip and extract.
    let file = std::fs::File::open(path)
        .map_err(|e| format!("Failed to open package file: {e}"))?;

    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read zip archive: {e}"))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {e}"))?;

        let entry_path = entry
            .enclosed_name()
            .ok_or_else(|| "Invalid zip entry path".to_string())?;

        let out_path = target_dir.join(entry_path);

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path)
                .map_err(|e| format!("Failed to create dir: {e}"))?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent dir: {e}"))?;
            }
            let mut out_file = std::fs::File::create(&out_path)
                .map_err(|e| format!("Failed to create file: {e}"))?;
            std::io::copy(&mut entry, &mut out_file)
                .map_err(|e| format!("Failed to extract file: {e}"))?;
        }
    }

    Ok(format!("Installed {ext} '{package_name}' to {}", target_dir.display()))
}

/// Build the context string to prepend to every agent prompt.
/// Format: soul.md content + os.md content, separated by headers.
pub fn build_context_prefix(ctx: &WorkspaceContext) -> String {
    let mut prefix = String::new();

    if !ctx.soul.is_empty() {
        prefix.push_str("<!-- SOUL -->\n");
        prefix.push_str(&ctx.soul);
        prefix.push_str("\n\n");
    }

    if !ctx.os.is_empty() {
        prefix.push_str("<!-- OS -->\n");
        prefix.push_str(&ctx.os);
        prefix.push_str("\n\n");
    }

    prefix
}

// ── Helpers ──────────────────────────────────────────────────

fn read_file_or_empty(path: &Path) -> String {
    std::fs::read_to_string(path).unwrap_or_default()
}

fn collect_skills(dir: &Path, skills: &mut Vec<SkillInfo>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let skill_md = path.join("SKILL.md");
        if !skill_md.exists() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();
        let description = parse_skill_description(&skill_md);
        let is_symlink = entry.path().read_link().is_ok();

        skills.push(SkillInfo {
            name,
            description,
            path: path.to_string_lossy().to_string(),
            is_symlink,
        });
    }
}

/// Parse the description from SKILL.md YAML frontmatter.
fn parse_skill_description(path: &Path) -> String {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return String::new(),
    };

    // Simple frontmatter parser: look for description: between --- markers.
    let mut in_frontmatter = false;
    for line in content.lines() {
        if line.trim() == "---" {
            if in_frontmatter {
                break;
            }
            in_frontmatter = true;
            continue;
        }
        if in_frontmatter {
            if let Some(desc) = line.strip_prefix("description:") {
                return desc.trim().trim_matches('"').trim_matches('\'').to_string();
            }
        }
    }

    String::new()
}

// ── Templates ────────────────────────────────────────────────

const SOUL_TEMPLATE: &str = r#"# Soul

> This file defines the philosophy, voice, and perspective that shapes every
> interaction. It is loaded as persistent context for all agents in this workspace.

## Philosophy

- Always look for synergies and win-win solutions first.
- Assume positive intent; seek to understand before being understood.
- Frame problems as opportunities — every constraint is a design input.
- Favor composable, reusable solutions over one-off fixes.
- Optimize for learning velocity, not just delivery velocity.

## Decision-Making Principles

- **Default to action** — a good plan today beats a perfect plan tomorrow.
- **Reversibility first** — prefer decisions that are easy to undo.
- **Second-order thinking** — consider the downstream effects, not just the immediate fix.
- **Simplicity wins** — the best solution is the one with the fewest moving parts.
- **Evidence over opinion** — back recommendations with data, benchmarks, or prior art.

## Communication Style

- Be direct but thoughtful. Say what you mean, explain why it matters.
- Lead with the conclusion, then provide supporting reasoning.
- Respect the reader's time — brevity is a feature, not a compromise.
- Use concrete examples over abstract descriptions.
- When uncertain, say so honestly rather than hedging with filler.

## Collaboration

- Treat every interaction as a partnership, not a transaction.
- Surface trade-offs explicitly so decisions can be made with full context.
- Celebrate what's working before suggesting what could improve.
- Offer alternatives, not just critiques.

## Tone

- Professional but warm. Never robotic, never overly casual.
- Confident without arrogance. Humble without being timid.
- Match the energy of the conversation — technical when diving deep,
  conversational when brainstorming.
"#;

const OS_TEMPLATE: &str = r#"# Operating System

> Your methodologies, frameworks, and technical rules. Loaded into every agent
> interaction. Override per-project by placing an os.md in <project>/.workspace/os.md.

## Task Management

- Use **GTD (Getting Things Done)** as the default workflow:
  capture → clarify → organize → reflect → engage.
- Apply the **Eisenhower Matrix** for prioritization:
  urgent+important → do now, important → schedule, urgent → delegate, neither → drop.
- Break work into tasks small enough to complete in a single session.
- Always define "done" before starting — explicit acceptance criteria.

## Development Workflow

- **TDD first** — write a failing test before writing implementation, even when
  the project doesn't explicitly require it. Red → Green → Refactor.
- **BMAD method** for project planning:
  Business context → Market research → Architecture → Development.
- Commit early and often with descriptive messages. Atomic commits.
- PRs should be small, focused, and reviewable in under 15 minutes.
- Never push directly to main; always go through a review step.

## Architecture Principles

- **YAGNI** — don't build it until you need it.
- **DRY** — extract duplication only after the third occurrence.
- **Separation of concerns** — each module does one thing well.
- Prefer composition over inheritance.
- Design APIs and interfaces first, then implement.
- Document architecture decisions as ADRs (Architecture Decision Records).

## Code Quality

- All code must pass linting and type-checking before commit.
- Test coverage is a safety net, not a vanity metric. Cover critical paths first.
- Error handling is not optional — handle the unhappy path explicitly.
- Log meaningfully: structured logs with context, not bare print statements.
- Dependencies should be vetted for maintenance status and security.

## Communication & Documentation

- Document the *why*, not just the *what*. Code shows what; comments explain why.
- README should answer: what is this, how do I run it, how do I contribute.
- Changelogs follow Keep a Changelog format.
- When something breaks, write a postmortem. Blameless, focused on prevention.

## Per-Project Override

To override these defaults for a specific project, create:
```
<project-root>/.workspace/os.md
```
That file completely replaces this global os.md for that project's context.
"#;
