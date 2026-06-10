use std::fs;
use std::path::PathBuf;

use hermes_core::mcp::{parse_servers, serialize_servers, validate_server, McpServer};

fn store_path() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|home| home.join(".hermes").join("mcp.json"))
        .ok_or_else(|| "Cannot find home directory".to_string())
}

#[tauri::command]
pub fn list_mcp_servers() -> Result<Vec<McpServer>, String> {
    let path = store_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let contents = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    parse_servers(&contents)
}

#[tauri::command]
pub fn save_mcp_servers(servers: Vec<McpServer>) -> Result<(), String> {
    for server in &servers {
        validate_server(server)?;
    }

    let path = store_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let json = serialize_servers(&servers)?;
    fs::write(&path, json).map_err(|error| error.to_string())
}
