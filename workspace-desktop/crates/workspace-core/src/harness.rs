use serde::Serialize;
use std::process::Command;

/// Response from any agent harness.
#[derive(Clone, Serialize)]
pub struct ChatResponse {
    pub session_id: String,
    pub response: String,
    pub agent: String,
}

/// Info about a discovered agent CLI.
#[derive(Clone, Serialize)]
pub struct AgentInfo {
    pub name: String,
    pub binary: String,
    pub version: String,
}

/// Discover which agent CLIs are installed on the system.
pub fn discover_agents() -> Vec<AgentInfo> {
    let candidates = [
        ("hermes",       &["hermes"][..]),
        ("claude",       &["claude"]),
        ("gemini",       &["gemini"]),
        ("codex",        &["codex"]),
        ("antigravity",  &["agy", "antigravity"]),
        ("ollama",       &["ollama"]),
        ("pi",           &["pi"]),
        ("aider",        &["aider"]),
        ("goose",        &["goose"]),
        ("amp",          &["amp"]),
    ];

    let mut agents = Vec::new();

    for (name, bins) in &candidates {
        for bin in *bins {
            if let Some(path) = which_bin(bin) {
                let version = get_version(bin, name);
                agents.push(AgentInfo {
                    name: name.to_string(),
                    binary: path,
                    version,
                });
                break;
            }
        }
    }

    agents
}

/// Dispatch a prompt to the right agent harness.
/// Loads workspace context (soul.md + os.md) and prepends it to every prompt.
pub fn send_prompt(
    agent: Option<String>,
    hermes_bin: Option<String>,
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
    model: Option<String>,
) -> Result<ChatResponse, String> {
    if text.trim().is_empty() {
        return Err("Prompt text is empty".to_string());
    }

    // Load workspace context and prepend soul + os to the prompt.
    let workspace_ctx = crate::workspace::load_workspace(cwd.clone());
    let prefix = crate::workspace::build_context_prefix(&workspace_ctx);
    let full_prompt = if prefix.is_empty() {
        text
    } else {
        format!("{prefix}{text}")
    };

    let agent_name = agent.as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or("hermes");

    match agent_name {
        "hermes" => crate::harness_hermes::send(hermes_bin, full_prompt, session_id, cwd, model),
        "claude" => crate::harness_claude::send(full_prompt, session_id, cwd, model),
        "gemini" => crate::harness_gemini::send(full_prompt, session_id, cwd, model),
        "codex" => crate::harness_codex::send(full_prompt, session_id, cwd, model),
        "antigravity" => crate::harness_antigravity::send(full_prompt, session_id, cwd, model),
        "pi" => crate::harness_pi::send(full_prompt, session_id, cwd),
        "ollama" => crate::harness_ollama::send(full_prompt, session_id, cwd, model),
        // Generic agents: aider, goose, amp, and future additions
        "aider" | "goose" | "amp" => {
            crate::harness_generic::send(agent_name, agent_name, full_prompt, session_id, cwd, model)
        }
        other => Err(format!("Unknown agent: {other}")),
    }
}

// ── Helpers ──────────────────────────────────────────────────

fn which_bin(name: &str) -> Option<String> {
    Command::new("which")
        .arg(name)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Public version of which_bin for use by agent harnesses.
pub fn which_bin_pub(name: &str) -> Option<String> {
    which_bin(name)
}

fn get_version(bin: &str, _agent_name: &str) -> String {
    Command::new(bin)
        .arg("--version")
        .output()
        .ok()
        .map(|o| {
            let out = String::from_utf8_lossy(&o.stdout);
            out.lines().next().unwrap_or("").trim().to_string()
        })
        .unwrap_or_default()
}

// ── Shared output cleaning ──────────────────────────────────

/// Strip ANSI escape sequences from text.
pub fn strip_ansi(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '\x1b' {
            match chars.peek() {
                Some('[') => {
                    chars.next();
                    while let Some(&next) = chars.peek() {
                        chars.next();
                        if next.is_ascii_alphabetic() || next == '~' {
                            break;
                        }
                    }
                }
                Some(']') => {
                    chars.next();
                    while let Some(&next) = chars.peek() {
                        if next == '\x07' {
                            chars.next();
                            break;
                        }
                        if next == '\x1b' {
                            chars.next();
                            if chars.peek() == Some(&'\\') {
                                chars.next();
                            }
                            break;
                        }
                        chars.next();
                    }
                }
                _ => {
                    chars.next();
                }
            }
        } else {
            result.push(ch);
        }
    }

    result
}

/// Collapse excessive blank lines, strip diff blocks, and trim.
pub fn clean_output(raw: &str) -> String {
    let stripped = strip_ansi(raw);

    // First pass: strip diff blocks and large code blocks
    let collapsed = collapse_blocks(&stripped);

    // Second pass: collapse excessive blank lines
    let mut result = String::with_capacity(collapsed.len());
    let mut blank_count = 0;

    for line in collapsed.lines() {
        if line.trim().is_empty() {
            blank_count += 1;
            if blank_count <= 2 {
                result.push('\n');
            }
        } else {
            blank_count = 0;
            if !result.is_empty() {
                result.push('\n');
            }
            result.push_str(line);
        }
    }

    result.trim().to_string()
}

/// Collapse diff blocks, code fences, and tool review sections into short summaries.
fn collapse_blocks(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let mut lines = input.lines().peekable();

    while let Some(line) = lines.next() {
        let trimmed = line.trim();

        // Detect diff block: "┊ review diff a/file → b/file"
        if trimmed.starts_with("┊ review diff") || trimmed.starts_with("┊ review diff") {
            // Extract filename from the diff header
            let filename = trimmed
                .rsplit("→ b/")
                .next()
                .or_else(|| trimmed.rsplit("→ b/").next())
                .unwrap_or("file")
                .trim();

            // Skip all lines until the diff block ends (next non-diff content)
            while let Some(&next) = lines.peek() {
                let nt = next.trim();
                if nt.starts_with('+') || nt.starts_with('-') || nt.starts_with('@')
                    || nt.starts_with("…") || nt.starts_with("... omitted")
                    || nt.is_empty()
                    || nt.starts_with("<!") || nt.starts_with("<html") || nt.starts_with("<head")
                    || nt.starts_with("<body") || nt.starts_with("<style") || nt.starts_with("</")
                    || nt.starts_with("<h") || nt.starts_with("<table") || nt.starts_with("<t")
                    || nt.starts_with("<span") || nt.starts_with("```")
                {
                    lines.next();
                } else {
                    break;
                }
            }

            result.push_str(&format!("\n📄 *[file changed: {filename}]*\n"));
            continue;
        }

        // Detect fenced code blocks with HTML/diff content
        if trimmed.starts_with("```html") || trimmed.starts_with("```diff") {
            let lang = trimmed.trim_start_matches('`').trim();
            // Skip until closing ```
            while let Some(next) = lines.next() {
                if next.trim() == "```" {
                    break;
                }
            }
            result.push_str(&format!("\n📄 *[{lang} block omitted]*\n"));
            continue;
        }

        result.push_str(line);
        result.push('\n');
    }

    result
}

/// List available models — delegates to hermes provider cache.
/// Kept for backward compatibility; prefer list_models_for_agent().
pub fn list_models() -> Vec<String> {
    crate::harness_hermes::list_models()
}

/// Read the current default model from hermes config.yaml.
/// Returns something like "deepseek/deepseek-v4-flash".
pub fn get_default_model() -> Option<String> {
    let config_path = dirs::home_dir()
        .map(|h| h.join(".hermes").join("config.yaml"))?;

    let contents = std::fs::read_to_string(&config_path).ok()?;

    let mut in_model_section = false;
    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed == "model:" {
            in_model_section = true;
            continue;
        }
        if in_model_section {
            if !line.starts_with(' ') && !line.starts_with('\t') && !trimmed.is_empty() {
                break;
            }
            if let Some(value) = trimmed.strip_prefix("default:") {
                let model = value.trim().trim_matches('\'').trim_matches('"');
                if !model.is_empty() {
                    return Some(model.to_string());
                }
            }
        }
    }

    None
}

/// Return models for a given agent by dispatching to each harness's list_models().
/// Each harness is responsible for querying its own CLI/API/config.
pub fn list_models_for_agent(agent: &str) -> Vec<String> {
    match agent {
        "hermes"       => crate::harness_hermes::list_models(),
        "claude"       => crate::harness_claude::list_models(),
        "gemini"       => crate::harness_gemini::list_models(),
        "codex"        => crate::harness_codex::list_models(),
        "antigravity"  => crate::harness_antigravity::list_models(),
        "ollama"       => crate::harness_ollama::list_models(),
        // Agents without model selection return empty
        "pi"           => Vec::new(),
        // Generic / unknown: fall back to hermes cache
        _              => crate::harness_hermes::list_models(),
    }
}
