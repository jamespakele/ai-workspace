use std::process::Command;
use super::harness::{ChatResponse, clean_output};

/// Hermes (NousResearch) — full-featured coding agent.
/// CLI: `hermes chat -q "text" -Q --resume <id>`
pub fn send(
    hermes_bin: Option<String>,
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
) -> Result<ChatResponse, String> {
    let bin = hermes_bin
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "hermes".to_string());

    let mut cmd = Command::new(&bin);
    cmd.args(["chat", "-q", &text, "-Q"]);

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
