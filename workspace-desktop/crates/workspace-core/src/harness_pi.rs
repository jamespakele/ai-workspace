use std::process::Command;
use crate::harness::{ChatResponse, clean_output};

/// Pi (Earendil Works) — minimalist coding agent.
/// Non-interactive: `pi -p "text"`
/// JSON mode: `pi -p "text" --mode json`
pub fn send(
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
) -> Result<ChatResponse, String> {
    let bin = "pi";

    let mut cmd = Command::new(bin);
    cmd.args(["-p", &text]);

    if let Some(dir) = &cwd {
        if !dir.is_empty() {
            cmd.current_dir(dir);
        }
    }

    let output = cmd.output().map_err(|error| {
        format!("Failed to run pi: {error}. Install: npm install -g @earendil-works/pi-coding-agent")
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let detail = if stderr.trim().is_empty() { stdout.trim().to_string() } else { stderr.trim().to_string() };
        return Err(format!("pi exited with {}: {detail}", output.status));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let response = clean_output(&stdout);

    Ok(ChatResponse {
        session_id: session_id.unwrap_or_default(),
        response,
        agent: "pi".to_string(),
    })
}
