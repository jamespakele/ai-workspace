use std::process::Command;
use crate::harness::{ChatResponse, clean_output};

/// Ollama — local LLM inference via `ollama run <model> "<prompt>"`.
/// Model selection: uses the model param, or defaults to the first installed model.
/// Non-interactive: pipes prompt as a positional argument.
pub fn send(
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
    model: Option<String>,
) -> Result<ChatResponse, String> {
    let model_name = match &model {
        Some(m) if !m.is_empty() => m.clone(),
        _ => {
            // Pick the first installed model
            let models = list_ollama_models();
            models.into_iter().next()
                .ok_or_else(|| "No Ollama models installed. Run: ollama pull <model>".to_string())?
        }
    };

    let mut cmd = Command::new("ollama");
    cmd.args(["run", &model_name, &text]);

    if let Some(dir) = &cwd {
        if !dir.is_empty() {
            cmd.current_dir(dir);
        }
    }

    let output = cmd.output().map_err(|error| {
        format!("Failed to run ollama: {error}. Install: https://ollama.com/download")
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let detail = if stderr.trim().is_empty() {
            stdout.trim().to_string()
        } else {
            stderr.trim().to_string()
        };
        return Err(format!("ollama exited with {}: {detail}", output.status));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let response = clean_output(&stdout);

    Ok(ChatResponse {
        session_id: session_id.unwrap_or_default(),
        response,
        agent: "ollama".to_string(),
    })
}

/// List locally installed Ollama models by parsing `ollama list` output.
/// Returns model names like ["gemma4:12b", "llama3:8b"].
pub fn list_ollama_models() -> Vec<String> {
    let output = match Command::new("ollama").arg("list").output() {
        Ok(o) if o.status.success() => o,
        _ => return Vec::new(),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut models = Vec::new();

    for line in stdout.lines().skip(1) {
        // Each line: NAME  ID  SIZE  MODIFIED
        let name = line.split_whitespace().next().unwrap_or("").trim();
        if !name.is_empty() {
            models.push(name.to_string());
        }
    }

    models
}
