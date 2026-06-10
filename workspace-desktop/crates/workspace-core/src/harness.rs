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
        ("hermes", &["hermes"][..]),
        ("claude", &["claude"]),
        ("gemini", &["gemini"]),
        ("codex", &["codex"]),
        ("pi", &["pi"]),
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
        "claude" => crate::harness_claude::send(full_prompt, session_id, cwd),
        "gemini" => crate::harness_gemini::send(full_prompt, session_id, cwd),
        "codex" => crate::harness_codex::send(full_prompt, session_id, cwd),
        "pi" => crate::harness_pi::send(full_prompt, session_id, cwd),
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

/// Collapse excessive blank lines and trim.
pub fn clean_output(raw: &str) -> String {
    let stripped = strip_ansi(raw);
    let mut result = String::with_capacity(stripped.len());
    let mut blank_count = 0;

    for line in stripped.lines() {
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

/// List available models from the hermes provider cache.
/// Returns a sorted list of model ID strings.
pub fn list_models() -> Vec<String> {
    let cache_path = dirs::home_dir()
        .map(|h| h.join(".hermes").join("provider_models_cache.json"));

    let path = match cache_path {
        Some(p) if p.exists() => p,
        _ => return Vec::new(),
    };

    let contents = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    // The cache is {"openrouter": {"models": [{"id": "...", ...}, ...], ...}}
    let parsed: serde_json::Value = match serde_json::from_str(&contents) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let mut models = Vec::new();

    if let Some(obj) = parsed.as_object() {
        for (_provider, provider_data) in obj {
            // Try "models" key first, then "data"
            for key in &["models", "data"] {
                if let Some(model_list) = provider_data.get(*key).and_then(|m| m.as_array()) {
                    for model in model_list {
                        // Models can be plain strings or objects with an "id" field
                        if let Some(id) = model.as_str() {
                            models.push(id.to_string());
                        } else if let Some(id) = model.get("id").and_then(|i| i.as_str()) {
                            models.push(id.to_string());
                        }
                    }
                }
            }
        }
    }

    models.sort();
    models.dedup();
    models
}

/// Read the current default model from hermes config.yaml.
/// Returns something like "deepseek/deepseek-v4-flash".
pub fn get_default_model() -> Option<String> {
    let config_path = dirs::home_dir()
        .map(|h| h.join(".hermes").join("config.yaml"))?;

    let contents = std::fs::read_to_string(&config_path).ok()?;

    // Simple YAML parsing: find "model:" section, then "default:" line
    let mut in_model_section = false;
    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed == "model:" {
            in_model_section = true;
            continue;
        }
        if in_model_section {
            // If we hit a non-indented line, we've left the model section
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
