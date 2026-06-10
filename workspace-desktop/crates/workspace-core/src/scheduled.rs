use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledTask {
    pub id: String,
    pub name: String,
    pub cron: String,
    pub command: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

fn store_path() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|home| home.join(".workspace").join("scheduled_tasks.json"))
        .ok_or_else(|| "Cannot find home directory".to_string())
}

pub fn list_scheduled_tasks() -> Result<Vec<ScheduledTask>, String> {
    let path = store_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let contents = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    serde_json::from_str(&contents).map_err(|error| error.to_string())
}

pub fn save_scheduled_tasks(tasks: Vec<ScheduledTask>) -> Result<(), String> {
    let path = store_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let json = serde_json::to_string_pretty(&tasks).map_err(|error| error.to_string())?;
    fs::write(&path, json).map_err(|error| error.to_string())
}
