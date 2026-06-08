use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
}

#[tauri::command]
pub fn list_projects() -> Result<Vec<Project>, String> {
    Ok(Vec::new())
}

#[tauri::command]
pub fn add_project(_path: String) -> Result<(), String> {
    Ok(())
}
