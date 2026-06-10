use std::process::Command;
use crate::harness::{ChatResponse, clean_output};

/// OpenAI Codex CLI — coding agent.
/// Non-interactive: `codex exec "text"`
/// Model override: `codex exec -m <model> "text"`
/// Resume: `codex exec resume --last`
pub fn send(
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
    model: Option<String>,
) -> Result<ChatResponse, String> {
    let bin = "codex";

    let mut cmd = Command::new(bin);
    cmd.args(["exec", &text]);

    if let Some(m) = &model {
        if !m.is_empty() {
            cmd.args(["-m", m]);
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
        let stdout = String::from_utf8_lossy(&output.stdout);
        let detail = if stderr.trim().is_empty() { stdout.trim().to_string() } else { stderr.trim().to_string() };
        return Err(format!("codex exited with {}: {detail}", output.status));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let response = clean_output(&stdout);

    Ok(ChatResponse {
        session_id: session_id.unwrap_or_default(),
        response,
        agent: "codex".to_string(),
    })
}
