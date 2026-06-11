use std::process::Command;
use crate::harness::{ChatResponse, clean_output};

/// Google Gemini CLI — coding agent.
/// Non-interactive: `gemini -p "text"`
/// Model override: `gemini -m <model> -p "text"`
pub fn send(
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
    model: Option<String>,
) -> Result<ChatResponse, String> {
    let bin = "gemini";

    let mut cmd = Command::new(bin);
    cmd.args(["-p", &text]);

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
        format!("Failed to run gemini: {error}. Install: npm install -g @google/gemini-cli")
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let detail = if stderr.trim().is_empty() { stdout.trim().to_string() } else { stderr.trim().to_string() };
        return Err(format!("gemini exited with {}: {detail}", output.status));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let response = clean_output(&stdout);

    Ok(ChatResponse {
        session_id: session_id.unwrap_or_default(),
        response,
        agent: "gemini".to_string(),
    })
}

/// List available Gemini models.
/// The Gemini CLI doesn't have a `models` subcommand, so we return the known
/// model IDs that it accepts via the `-m` flag.
pub fn list_models() -> Vec<String> {
    vec![
        "gemini-2.5-pro".to_string(),
        "gemini-2.5-flash".to_string(),
        "gemini-2.0-flash".to_string(),
    ]
}

