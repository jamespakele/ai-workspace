use serde::Serialize;
use std::cmp::Ordering;

#[derive(Debug, Clone, Serialize, Default)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

const FILTERED: &[&str] = &["node_modules", "__pycache__", "target"];

#[tauri::command]
pub fn read_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let dir = std::path::Path::new(&path);
    if !dir.is_dir() {
        return Ok(Vec::new());
    }

    let read = match std::fs::read_dir(dir) {
        Ok(read) => read,
        Err(_) => return Ok(Vec::new()),
    };

    let mut entries: Vec<DirEntry> = read
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || FILTERED.contains(&name.as_str()) {
                return None;
            }

            let is_dir = entry.file_type().ok()?.is_dir();
            Some(DirEntry {
                name,
                path: entry.path().to_string_lossy().to_string(),
                is_dir,
            })
        })
        .collect();

    entries.sort_by(|left, right| match (left.is_dir, right.is_dir) {
        (true, false) => Ordering::Less,
        (false, true) => Ordering::Greater,
        _ => left.name.cmp(&right.name),
    });

    Ok(entries)
}
