use serde::Serialize;

#[derive(Debug, Clone, Serialize, Default)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[tauri::command]
pub fn read_dir(_path: String) -> Result<Vec<DirEntry>, String> {
    Ok(Vec::new())
}
