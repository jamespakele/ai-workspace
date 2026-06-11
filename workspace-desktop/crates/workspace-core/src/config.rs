use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    #[serde(default)]
    pub hermes_bin: String,
    #[serde(default = "default_gateway_url")]
    pub gateway_url: String,
    #[serde(default)]
    pub auto_start_gateway: bool,
    #[serde(default)]
    pub active_project: String,
    #[serde(default)]
    pub agent: String,
    #[serde(default)]
    pub context_window: Option<u64>,
    /// Route prompts through the Agent Client Protocol when the agent
    /// supports it (falls back to the legacy flag-based harness).
    #[serde(default = "default_true")]
    pub acp_enabled: bool,
    /// Auto-approve ACP permission requests instead of rejecting them.
    #[serde(default)]
    pub acp_auto_approve: bool,
    /// Per-agent ACP launch command overrides, e.g.
    /// { "antigravity": "agy --acp" }. Whitespace-split; first token is the
    /// binary.
    #[serde(default)]
    pub acp_launch_overrides: HashMap<String, String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            hermes_bin: String::new(),
            gateway_url: default_gateway_url(),
            auto_start_gateway: false,
            active_project: String::new(),
            agent: "hermes".to_string(),
            context_window: None,
            acp_enabled: true,
            acp_auto_approve: false,
            acp_launch_overrides: HashMap::new(),
        }
    }
}

fn default_true() -> bool {
    true
}

fn default_gateway_url() -> String {
    "ws://localhost:8765".to_string()
}

fn config_dir() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|home| home.join(".config").join("workspace-desktop"))
        .ok_or_else(|| "Cannot determine home directory".to_string())
}

fn config_path() -> Result<PathBuf, String> {
    Ok(config_dir()?.join("config.json"))
}

fn detect_hermes_bin() -> String {
    Command::new("which")
        .arg("hermes")
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() {
                String::from_utf8(output.stdout)
                    .ok()
                    .map(|path| path.trim().to_string())
            } else {
                None
            }
        })
        .unwrap_or_default()
}

pub fn get_config() -> Result<AppConfig, String> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(AppConfig {
            hermes_bin: detect_hermes_bin(),
            ..AppConfig::default()
        });
    }

    let contents = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    serde_json::from_str(&contents).map_err(|error| error.to_string())
}

pub fn save_config(config: AppConfig) -> Result<(), String> {
    let dir = config_dir()?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;

    let json = serde_json::to_string_pretty(&config).map_err(|error| error.to_string())?;
    fs::write(dir.join("config.json"), json).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_config_without_acp_fields_gets_defaults() {
        let config: AppConfig =
            serde_json::from_str(r#"{ "agent": "claude" }"#).expect("parse");
        assert!(config.acp_enabled, "ACP should default ON");
        assert!(!config.acp_auto_approve, "auto-approve should default OFF");
        assert!(config.acp_launch_overrides.is_empty());
        assert_eq!(config.agent, "claude");
    }

    #[test]
    fn acp_fields_round_trip() {
        let mut config = AppConfig::default();
        config.acp_enabled = false;
        config.acp_auto_approve = true;
        config
            .acp_launch_overrides
            .insert("antigravity".to_string(), "agy --acp".to_string());

        let json = serde_json::to_string(&config).expect("serialize");
        let parsed: AppConfig = serde_json::from_str(&json).expect("parse");
        assert!(!parsed.acp_enabled);
        assert!(parsed.acp_auto_approve);
        assert_eq!(parsed.acp_launch_overrides["antigravity"], "agy --acp");
    }
}
