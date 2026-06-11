use std::process::Command;
use crate::harness::{ChatResponse, clean_output};

/// Pi (Earendil Works) — multi-provider coding agent.
/// Non-interactive: `pi -p "text"`
/// Model override: `pi --model <model> -p "text"`
/// Provider prefix: `pi --model openai/gpt-4o -p "text"`
/// JSON mode: `pi -p "text" --mode json`
pub fn send(
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
    model: Option<String>,
) -> Result<ChatResponse, String> {
    let bin = resolve_bin();

    let mut cmd = Command::new(bin);
    cmd.args(["-p", &text]);

    if let Some(m) = &model {
        if !m.is_empty() {
            cmd.args(["--model", m]);
        }
    }

    if let Some(sid) = &session_id {
        if !sid.is_empty() {
            cmd.args(["--session-id", sid]);
        }
    }

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

/// List available Pi models by running `pi --list-models`.
/// Parses the table output to extract "provider/model" or just "model" strings.
pub fn list_models() -> Vec<String> {
    let bin = resolve_bin();

    let output = match Command::new(bin).arg("--list-models").output() {
        Ok(o) if o.status.success() => o,
        _ => return Vec::new(),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut models = Vec::new();

    for line in stdout.lines().skip(1) {
        // Table format: "provider      model      context  max-out  thinking  images"
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let provider = parts[0];
            let model = parts[1];
            // Use "provider/model" format for non-default providers
            // Skip the header separator if any
            if model.contains('/') || model.contains('-') || model.contains('.') {
                models.push(format!("{}/{}", provider, model));
            }
        }
    }

    models
}

/// Resolve the pi binary — search standard locations in order.
fn resolve_bin() -> String {
    // Check PATH first
    if Command::new("which").arg("pi").output()
        .map(|o| o.status.success()).unwrap_or(false) {
        return "pi".to_string();
    }

    // Search known install locations (Pi-native first, npm fallbacks after)
    if let Some(home) = dirs::home_dir() {
        let candidates = [
            home.join(".pi").join("bin").join("pi"),           // Pi's own bin
            home.join(".local").join("bin").join("pi"),         // User-local
            home.join(".hermes").join("node").join("bin").join("pi"), // npm global (may be hermes-managed)
        ];
        for path in &candidates {
            if path.exists() {
                return path.to_string_lossy().to_string();
            }
        }
    }

    // Last resort
    "pi".to_string()
}
