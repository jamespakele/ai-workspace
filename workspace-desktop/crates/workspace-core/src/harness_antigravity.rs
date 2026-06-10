use std::process::Command;
use crate::harness::{ChatResponse, clean_output, which_bin_pub};

/// Antigravity / AGY (Google) — AI coding agent.
/// Non-interactive: `agy -p "text"` or `agy --print "text"`
/// Model override: `agy --model <model> -p "text"`
/// Resume: `agy --conversation <session_id> -p "text"`
/// Continue: `agy -c -p "text"` (continue most recent)
pub fn send(
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
    model: Option<String>,
) -> Result<ChatResponse, String> {
    // Try agy first, fall back to antigravity
    let bin = if which_bin_pub("agy").is_some() {
        "agy"
    } else {
        "antigravity"
    };

    let mut cmd = Command::new(bin);
    cmd.args(["-p", &text]);

    if let Some(m) = &model {
        if !m.is_empty() {
            cmd.args(["--model", m]);
        }
    }

    if let Some(sid) = &session_id {
        if !sid.is_empty() {
            cmd.args(["--conversation", sid]);
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
        let detail = if stderr.trim().is_empty() { stdout.trim().to_string() } else { stderr.trim().to_string() };
        return Err(format!("{bin} exited with {}: {detail}", output.status));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let response = clean_output(&stdout);

    Ok(ChatResponse {
        session_id: session_id.unwrap_or_default(),
        response,
        agent: "antigravity".to_string(),
    })
}
