use serde::Serialize;
use std::cmp::Ordering;
use std::io::Read;

use hermes_core::preview::{is_binary, truncate_utf8, MAX_PREVIEW_BYTES};

#[derive(Debug, Clone, Serialize, Default)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct FilePreview {
    pub content: String,
    pub truncated: bool,
    pub binary: bool,
}

#[tauri::command]
pub fn read_file(path: String) -> Result<FilePreview, String> {
    let file_path = std::path::Path::new(&path);
    if !file_path.is_file() {
        return Err(format!("Not a file: {path}"));
    }

    // Read at most the preview cap plus one byte so truncation is detectable
    // without loading huge files into memory.
    let file = std::fs::File::open(file_path).map_err(|error| error.to_string())?;
    let mut bytes = Vec::with_capacity(64 * 1024);
    file.take(MAX_PREVIEW_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;

    if is_binary(&bytes) {
        return Ok(FilePreview {
            content: String::new(),
            truncated: false,
            binary: true,
        });
    }

    let text = String::from_utf8_lossy(&bytes);
    let (content, truncated) = truncate_utf8(&text, MAX_PREVIEW_BYTES);

    Ok(FilePreview {
        content: content.to_string(),
        truncated,
        binary: false,
    })
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
