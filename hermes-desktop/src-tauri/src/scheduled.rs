use std::fs;
use std::path::PathBuf;

use hermes_core::schedule::{parse_tasks, serialize_tasks, ScheduledTask};

fn store_path() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|home| home.join(".hermes").join("scheduled_tasks.json"))
        .ok_or_else(|| "Cannot find home directory".to_string())
}

#[tauri::command]
pub fn list_scheduled_tasks() -> Result<Vec<ScheduledTask>, String> {
    let path = store_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let contents = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    parse_tasks(&contents)
}

#[tauri::command]
pub fn save_scheduled_tasks(tasks: Vec<ScheduledTask>) -> Result<(), String> {
    let path = store_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let json = serialize_tasks(&tasks)?;
    fs::write(&path, json).map_err(|error| error.to_string())
}
