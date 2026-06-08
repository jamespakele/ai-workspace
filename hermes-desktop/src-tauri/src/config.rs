use serde::{Deserialize, Serialize};
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
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            hermes_bin: String::new(),
            gateway_url: default_gateway_url(),
            auto_start_gateway: false,
            active_project: String::new(),
        }
    }
}

fn default_gateway_url() -> String {
    "ws://localhost:8765".to_string()
}

fn config_dir() -> Result<PathBuf, String> {
    std::env::var("HOME")
        .map(|home| PathBuf::from(home).join(".config").join("hermes-desktop"))
        .map_err(|error| error.to_string())
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

#[tauri::command]
pub async fn get_config(_app_handle: tauri::AppHandle) -> Result<AppConfig, String> {
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

#[tauri::command]
pub async fn save_config(config: AppConfig) -> Result<(), String> {
    let dir = config_dir()?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;

    let json = serde_json::to_string_pretty(&config).map_err(|error| error.to_string())?;
    fs::write(dir.join("config.json"), json).map_err(|error| error.to_string())
}
