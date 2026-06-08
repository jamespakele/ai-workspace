use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
}

fn hermes_dir() -> Result<PathBuf, String> {
    std::env::var("HOME")
        .map(|home| PathBuf::from(home).join(".hermes"))
        .map_err(|error| error.to_string())
}

fn load_projects() -> Vec<Project> {
    let path = match hermes_dir() {
        Ok(dir) => dir.join("projects.json"),
        Err(_) => return Vec::new(),
    };

    if !path.exists() {
        return Vec::new();
    }

    std::fs::read_to_string(path)
        .ok()
        .and_then(|contents| serde_json::from_str::<Vec<Project>>(&contents).ok())
        .unwrap_or_default()
}

fn path_id(path: &str) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

#[tauri::command]
pub fn list_projects() -> Result<Vec<Project>, String> {
    Ok(load_projects())
}

#[tauri::command]
pub fn add_project(path: String) -> Result<(), String> {
    let mut projects = load_projects();
    if projects.iter().any(|project| project.path == path) {
        return Ok(());
    }

    let name = Path::new(&path)
        .file_name()
        .map(|part| part.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    projects.push(Project {
        id: path_id(&path),
        name,
        path,
    });

    let dir = hermes_dir()?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;

    let json = serde_json::to_string_pretty(&projects).map_err(|error| error.to_string())?;
    std::fs::write(dir.join("projects.json"), json).map_err(|error| error.to_string())
}
