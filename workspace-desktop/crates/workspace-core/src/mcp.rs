use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServer {
    pub name: String,
    pub transport: String,
    #[serde(default)]
    pub command: String,
    #[serde(default)]
    pub url: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

fn validate_server(server: &McpServer) -> Result<(), String> {
    if server.name.trim().is_empty() {
        return Err("Server name is required".to_string());
    }
    match server.transport.as_str() {
        "stdio" => {
            if server.command.trim().is_empty() {
                return Err("Command is required for stdio transport".to_string());
            }
        }
        "http" => {
            if server.url.trim().is_empty() {
                return Err("URL is required for http transport".to_string());
            }
        }
        other => return Err(format!("Unknown transport: {other}")),
    }
    Ok(())
}

fn store_path() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|home| home.join(".workspace").join("mcp.json"))
        .ok_or_else(|| "Cannot find home directory".to_string())
}

pub fn list_mcp_servers() -> Result<Vec<McpServer>, String> {
    let path = store_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let contents = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    serde_json::from_str(&contents).map_err(|error| error.to_string())
}

pub fn save_mcp_servers(servers: Vec<McpServer>) -> Result<(), String> {
    for server in &servers {
        validate_server(server)?;
    }

    let path = store_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let json = serde_json::to_string_pretty(&servers).map_err(|error| error.to_string())?;
    fs::write(&path, json).map_err(|error| error.to_string())
}
