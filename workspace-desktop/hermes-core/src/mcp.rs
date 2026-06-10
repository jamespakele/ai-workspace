//! Connector (MCP server) configuration stored at `~/.hermes/mcp.json`.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct McpServer {
    pub name: String,
    /// `stdio` or `http`.
    pub transport: String,
    /// Command line for stdio transports, URL for http transports.
    #[serde(default)]
    pub command: String,
    #[serde(default)]
    pub url: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_enabled() -> bool {
    true
}

pub fn parse_servers(json: &str) -> Result<Vec<McpServer>, String> {
    let trimmed = json.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    serde_json::from_str(trimmed).map_err(|error| error.to_string())
}

pub fn serialize_servers(servers: &[McpServer]) -> Result<String, String> {
    serde_json::to_string_pretty(servers).map_err(|error| error.to_string())
}

/// Validate a server entry before persisting it.
pub fn validate_server(server: &McpServer) -> Result<(), String> {
    if server.name.trim().is_empty() {
        return Err("connector name is required".to_string());
    }

    match server.transport.as_str() {
        "stdio" => {
            if server.command.trim().is_empty() {
                return Err("stdio connectors require a command".to_string());
            }
        }
        "http" => {
            if !server.url.starts_with("http://") && !server.url.starts_with("https://") {
                return Err("http connectors require an http(s) URL".to_string());
            }
        }
        other => return Err(format!("unknown transport \"{other}\"")),
    }

    Ok(())
}

/// Add a server, rejecting duplicates by name (case-insensitive).
pub fn add_server(mut servers: Vec<McpServer>, server: McpServer) -> Result<Vec<McpServer>, String> {
    validate_server(&server)?;

    let name = server.name.to_lowercase();
    if servers
        .iter()
        .any(|existing| existing.name.to_lowercase() == name)
    {
        return Err(format!("connector \"{}\" already exists", server.name));
    }

    servers.push(server);
    Ok(servers)
}

pub fn remove_server(servers: Vec<McpServer>, name: &str) -> Vec<McpServer> {
    servers
        .into_iter()
        .filter(|server| server.name != name)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stdio_server(name: &str) -> McpServer {
        McpServer {
            name: name.to_string(),
            transport: "stdio".to_string(),
            command: "npx some-mcp".to_string(),
            url: String::new(),
            enabled: true,
        }
    }

    #[test]
    fn empty_input_parses_to_empty_list() {
        assert_eq!(parse_servers("").unwrap(), Vec::new());
    }

    #[test]
    fn round_trip_preserves_servers() {
        let servers = vec![stdio_server("slack")];
        let json = serialize_servers(&servers).unwrap();
        assert_eq!(parse_servers(&json).unwrap(), servers);
    }

    #[test]
    fn add_rejects_duplicate_names_case_insensitively() {
        let servers = add_server(Vec::new(), stdio_server("Slack")).unwrap();
        let error = add_server(servers, stdio_server("slack")).unwrap_err();
        assert!(error.contains("already exists"));
    }

    #[test]
    fn add_rejects_empty_name() {
        let mut server = stdio_server("");
        server.name = "   ".to_string();
        assert!(add_server(Vec::new(), server).is_err());
    }

    #[test]
    fn add_rejects_stdio_without_command() {
        let mut server = stdio_server("gmail");
        server.command = String::new();
        assert!(add_server(Vec::new(), server).is_err());
    }

    #[test]
    fn add_rejects_http_without_valid_url() {
        let server = McpServer {
            name: "drive".to_string(),
            transport: "http".to_string(),
            command: String::new(),
            url: "ftp://nope".to_string(),
            enabled: true,
        };
        assert!(add_server(Vec::new(), server).is_err());
    }

    #[test]
    fn add_accepts_http_with_url() {
        let server = McpServer {
            name: "drive".to_string(),
            transport: "http".to_string(),
            command: String::new(),
            url: "https://example.com/mcp".to_string(),
            enabled: true,
        };
        assert_eq!(add_server(Vec::new(), server).unwrap().len(), 1);
    }

    #[test]
    fn add_rejects_unknown_transport() {
        let mut server = stdio_server("x");
        server.transport = "carrier-pigeon".to_string();
        assert!(add_server(Vec::new(), server).is_err());
    }

    #[test]
    fn remove_filters_by_exact_name() {
        let servers = vec![stdio_server("a"), stdio_server("b")];
        let remaining = remove_server(servers, "a");
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].name, "b");
    }
}
