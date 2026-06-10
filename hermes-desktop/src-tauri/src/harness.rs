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
#[tauri::command]
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
#[tauri::command]
pub fn send_prompt(
    agent: Option<String>,
    hermes_bin: Option<String>,
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
) -> Result<ChatResponse, String> {
    if text.trim().is_empty() {
        return Err("Prompt text is empty".to_string());
    }

    let agent_name = agent.as_deref().unwrap_or("hermes");

    match agent_name {
        "hermes" => super::harness_hermes::send(hermes_bin, text, session_id, cwd),
        "claude" => super::harness_claude::send(text, session_id, cwd),
        "gemini" => super::harness_gemini::send(text, session_id, cwd),
        "codex" => super::harness_codex::send(text, session_id, cwd),
        "pi" => super::harness_pi::send(text, session_id, cwd),
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

fn get_version(bin: &str, agent_name: &str) -> String {
    let flag = match agent_name {
        "hermes" => "--version",
        "claude" => "--version",
        "gemini" => "--version",
        "codex" => "--version",
        _ => "--version",
    };

    Command::new(bin)
        .arg(flag)
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
