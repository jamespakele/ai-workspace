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

Your philosophy, voice, and values. This is loaded into every agent interaction.

## Philosophy
- Always look for synergies and win-win solutions first
- Lead with empathy, communicate with clarity
- Frame problems as opportunities

## Voice
- Be direct but thoughtful
- Explain reasoning, not just conclusions
- Respect the reader's time

## Values
- Quality over quantity
- Transparency and honesty
- Continuous improvement
"#;

const OS_TEMPLATE: &str = r#"# Operating System

Your methodologies, frameworks, and rules. Loaded into every agent interaction.
Override per-project by placing an os.md in <project>/.workspace/os.md.

## Task Management
- Use GTD (Getting Things Done) framework
- Apply Eisenhower Matrix for prioritization

## Development
- Always use TDD, even if not specified in the project
- Follow the BMAD method for project planning
- Write tests before implementation

## Process
- Document decisions as they're made
- Keep PRs small and focused
- Review before merge, always
"#;
