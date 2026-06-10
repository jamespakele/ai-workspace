use std::process::Command;
use super::harness::{ChatResponse, clean_output};

/// Codex CLI (OpenAI) coding agent.
pub fn send(
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
) -> Result<ChatResponse, String> {
    let bin = "codex";

    let mut cmd = Command::new(bin);
    cmd.args(["-q", &text]);

    if let Some(sid) = &session_id {
        if !sid.is_empty() {
            cmd.args(["--session", sid]);
        }
    }

    if let Some(dir) = &cwd {
        if !dir.is_empty() {
            cmd.current_dir(dir);
        }
    }

    let output = cmd.output().map_err(|error| {
        format!("Failed to run codex: {error}. Install: npm install -g @openai/codex")
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("codex exited with {}: {}", output.status, stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    Ok(ChatResponse {
        session_id: session_id.unwrap_or_default(),
        response: clean_output(&stdout),
        agent: "codex".to_string(),
    })
}
