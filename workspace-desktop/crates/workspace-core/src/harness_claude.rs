use std::process::Command;
use crate::harness::{ChatResponse, clean_output};

/// Claude Code (Anthropic) — CLI coding agent.
/// CLI: `claude -p "text" --output-format text --resume <id>`
pub fn send(
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
) -> Result<ChatResponse, String> {
    let bin = "claude";

    let mut cmd = Command::new(bin);
    cmd.args(["-p", &text, "--output-format", "text"]);

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
        format!("Failed to run claude: {error}. Install: npm install -g @anthropic-ai/claude-code")
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("claude exited with {}: {}", output.status, stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let response = clean_output(&stdout);

    Ok(ChatResponse {
        session_id: session_id.unwrap_or_default(),
        response,
        agent: "claude".to_string(),
    })
}
