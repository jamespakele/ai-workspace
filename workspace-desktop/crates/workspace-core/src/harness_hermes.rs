use std::process::Command;
use crate::harness::{ChatResponse, clean_output};

/// Hermes (NousResearch) — full-featured coding agent.
/// CLI: `hermes chat -q "text" -Q --resume <id>`
pub fn send(
    hermes_bin: Option<String>,
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
    model: Option<String>,
) -> Result<ChatResponse, String> {
    let bin = hermes_bin
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "hermes".to_string());

    let mut cmd = Command::new(&bin);
    cmd.args(["chat", "-q", &text, "-Q"]);

    // Pass model if specified
    if let Some(m) = &model {
        if !m.is_empty() {
            cmd.args(["-m", m]);
        }
    }

    if let Some(sid) = &session_id {
        if !sid.is_empty() {
            cmd.args(["--resume", sid]);
        }
    }

    if let Some(dir) = &cwd {
        if !dir.is_empty() {
            cmd.current_dir(dir);
        }
    }

    let output = cmd.output().map_err(|error| {
        format!("Failed to run hermes: {error}")
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let detail = if stderr.trim().is_empty() {
            stdout.trim().to_string()
        } else {
            stderr.trim().to_string()
        };
        return Err(format!("hermes exited with {}: {detail}", output.status));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_quiet_output(&stdout)
}

/// Parse Hermes `-Q` output:
/// ```text
/// session_id: 20260610_042242_958bce
/// Hey there! What can I help you with?
/// ```
fn parse_quiet_output(raw: &str) -> Result<ChatResponse, String> {
    let mut session_id = String::new();
    let mut response_lines: Vec<&str> = Vec::new();
    let mut found_session = false;

    for line in raw.lines() {
        if !found_session {
            if let Some(id) = line.strip_prefix("session_id: ") {
                session_id = id.trim().to_string();
                found_session = true;
                continue;
            }
            if line.trim().is_empty() {
                continue;
            }
        } else {
            response_lines.push(line);
        }
    }

    if session_id.is_empty() {
        return Ok(ChatResponse {
            session_id: String::new(),
            response: clean_output(raw),
            agent: "hermes".to_string(),
        });
    }

    Ok(ChatResponse {
        session_id,
        response: clean_output(&response_lines.join("\n")),
        agent: "hermes".to_string(),
    })
}

/// List available models from the hermes provider cache (OpenRouter).
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
            for key in &["models", "data"] {
                if let Some(model_list) = provider_data.get(*key).and_then(|m| m.as_array()) {
                    for model in model_list {
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

