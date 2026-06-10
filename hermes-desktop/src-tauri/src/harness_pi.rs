use std::process::Command;
use super::harness::{ChatResponse, clean_output};

/// Pi (pi.dev) — open source barebones coding agent.
/// 4 core tools: Read, Write, Edit, Bash.
/// CLI: `pi` in a project directory.
pub fn send(
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
) -> Result<ChatResponse, String> {
    let bin = "pi";

    let mut cmd = Command::new(bin);

    // Pi uses -p for prompt in non-interactive mode.
    cmd.args(["-p", &text]);

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
        format!("Failed to run pi: {error}. Install: curl -fsSL https://pi.dev/install.sh | sh")
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("pi exited with {}: {}", output.status, stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let response = clean_output(&stdout);

    // TODO: parse session ID from pi's output format once confirmed.
    Ok(ChatResponse {
        session_id: session_id.unwrap_or_default(),
        response,
        agent: "pi".to_string(),
    })
}
