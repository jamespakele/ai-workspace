use std::process::Command;
use crate::harness::{ChatResponse, clean_output};

/// OpenAI Codex CLI — coding agent.
/// Non-interactive: `codex exec "text"`
/// Model override: `codex exec -m <model> "text"`
/// Working dir: `codex exec -C <dir> "text"`
/// Resume: `codex exec resume --last`
pub fn send(
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
    model: Option<String>,
) -> Result<ChatResponse, String> {
    let bin = "codex";

    let mut cmd = Command::new(bin);
    cmd.arg("exec");

    // Flags must come before the prompt argument
    if let Some(m) = &model {
        if !m.is_empty() {
            cmd.args(["-m", m]);
        }
    }

    if let Some(dir) = &cwd {
        if !dir.is_empty() {
            cmd.args(["-C", dir]);
        }
    }

    // Allow running outside a git repository
    cmd.arg("--skip-git-repo-check");

    // Prompt is the final positional argument
    cmd.arg(&text);

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

/// List available Codex models by reading ~/.codex/models_cache.json.
/// Each model entry has a "slug" field (e.g. "gpt-5.5", "gpt-5.4-mini").
/// Falls back to a sensible default if the cache can't be read.
pub fn list_models() -> Vec<String> {
    if let Some(models) = read_models_cache() {
        if !models.is_empty() {
            return models;
        }
    }
    // Fallback when cache is missing
    vec!["gpt-5.5".to_string()]
}

fn read_models_cache() -> Option<Vec<String>> {
    let cache_path = dirs::home_dir()?.join(".codex").join("models_cache.json");
    let contents = std::fs::read_to_string(&cache_path).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&contents).ok()?;

    let models_arr = parsed.as_array()
        .or_else(|| parsed.get("models").and_then(|m| m.as_array()))?;

    let slugs: Vec<String> = models_arr
        .iter()
        .filter_map(|m| m.get("slug").and_then(|s| s.as_str()))
        // Skip internal-only models like "codex-auto-review"
        .filter(|s| !s.contains("auto-review"))
        .map(|s| s.to_string())
        .collect();

    Some(slugs)
}

