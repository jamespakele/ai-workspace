use std::process::Command;
use crate::harness::{ChatResponse, clean_output};

/// Generic agent harness for CLI agents with different invocation patterns.
/// Handles: aider, goose, amp, and similar tools.
///
/// Agent CLI patterns (from docs):
///   aider:  `aider --message "text" --model <m> --yes --no-auto-commits`
///   goose:  `goose run "text"`
///   amp:    `amp --execute "text"`
pub fn send(
    agent_name: &str,
    bin: &str,
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
    model: Option<String>,
) -> Result<ChatResponse, String> {
    let mut cmd = Command::new(bin);

    match agent_name {
        "aider" => {
            // aider --message "text" --yes --no-auto-commits
            cmd.args(["--message", &text, "--yes", "--no-auto-commits"]);
            if let Some(m) = &model {
                if !m.is_empty() {
                    cmd.args(["--model", m]);
                }
            }
        }
        "goose" => {
            // goose run "text"
            cmd.args(["run", &text]);
        }
        "amp" => {
            // amp --execute "text"
            cmd.args(["--execute", &text]);
        }
        _ => {
            // Fallback: pass prompt as positional arg
            cmd.arg(&text);
        }
    }

    if let Some(dir) = &cwd {
        if !dir.is_empty() {
            cmd.current_dir(dir);
        }
    }

    let output = cmd.output().map_err(|error| {
        format!("Failed to run {bin}: {error}")
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let detail = if stderr.trim().is_empty() {
            stdout.trim().to_string()
        } else {
            stderr.trim().to_string()
        };
        return Err(format!("{bin} exited with {}: {detail}", output.status));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let response = clean_output(&stdout);

    Ok(ChatResponse {
        session_id: session_id.unwrap_or_default(),
        response,
        agent: agent_name.to_string(),
    })
}
