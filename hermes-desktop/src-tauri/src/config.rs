use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub hermes_bin: String,
    pub gateway_url: String,
    pub auto_start_gateway: bool,
    pub active_project: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            hermes_bin: String::new(),
            gateway_url: "ws://localhost:8765".to_string(),
            auto_start_gateway: true,
            active_project: String::new(),
        }
    }
}

#[tauri::command]
pub fn get_config() -> Result<AppConfig, String> {
    Ok(AppConfig::default())
}

#[tauri::command]
pub fn save_config(_config: AppConfig) -> Result<(), String> {
    Ok(())
}
