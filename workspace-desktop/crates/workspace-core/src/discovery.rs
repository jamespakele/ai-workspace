use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

const PROBE_TIMEOUT: Duration = Duration::from_millis(300);
pub const DEFAULT_GATEWAY_PORT: u16 = 8765;

#[derive(Debug, Clone, serde::Serialize)]
pub struct HermesInstance {
    pub id: String,
    pub kind: String,
    pub label: String,
    pub hermes_bin: Option<String>,
    pub gateway_url: Option<String>,
    pub reachable: bool,
}

#[derive(Debug, Clone)]
pub struct DockerGateway {
    pub container_id: String,
    pub name: String,
    pub image: String,
    pub host_port: u16,
}

fn port_is_open(port: u16) -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&address, PROBE_TIMEOUT).is_ok()
}

fn parse_which_output(stdout: &str) -> Vec<String> {
    stdout
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect()
}

fn candidate_binary_paths(home: &std::path::Path) -> Vec<PathBuf> {
    vec![
        home.join(".local/bin/hermes"),
        home.join(".cargo/bin/hermes"),
        home.join("bin/hermes"),
    ]
}

fn dedupe_paths(paths: Vec<String>) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    paths
        .into_iter()
        .filter(|p| seen.insert(p.clone()))
        .collect()
}

fn parse_docker_ps(stdout: &str) -> Vec<DockerGateway> {
    let mut gateways = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parsed: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let name = parsed["Names"].as_str().unwrap_or("").to_string();
        let image = parsed["Image"].as_str().unwrap_or("").to_string();
        let id = parsed["ID"].as_str().unwrap_or("").to_string();
        let ports = parsed["Ports"].as_str().unwrap_or("");

        // Look for hermes-related images
        if !image.contains("hermes") && !name.contains("hermes") {
            continue;
        }

        // Parse ports like "0.0.0.0:8765->8765/tcp"
        for port_spec in ports.split(',') {
            if let Some(host_part) = port_spec.split("->").next() {
                if let Some(port_str) = host_part.rsplit(':').next() {
                    if let Ok(port) = port_str.trim().parse::<u16>() {
                        gateways.push(DockerGateway {
                            container_id: id.clone(),
                            name: name.clone(),
                            image: image.clone(),
                            host_port: port,
                        });
                    }
                }
            }
        }
    }

    gateways
}

fn which_all() -> Vec<String> {
    Command::new("which")
        .args(["-a", "hermes"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|stdout| parse_which_output(&stdout))
        .unwrap_or_default()
}

fn docker_ps() -> Vec<DockerGateway> {
    Command::new("docker")
        .args(["ps", "--format", "{{json .}}"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|stdout| parse_docker_ps(&stdout))
        .unwrap_or_default()
}

pub fn discover_hermes() -> Result<Vec<HermesInstance>, String> {
    let mut instances = Vec::new();

    let mut binary_paths = which_all();
    if let Some(home) = dirs::home_dir() {
        for candidate in candidate_binary_paths(&home) {
            if candidate.is_file() {
                binary_paths.push(candidate.to_string_lossy().to_string());
            }
        }
    }

    let default_port_open = port_is_open(DEFAULT_GATEWAY_PORT);

    for path in dedupe_paths(binary_paths) {
        instances.push(HermesInstance {
            id: format!("binary:{path}"),
            kind: "binary".to_string(),
            label: path.clone(),
            hermes_bin: Some(path),
            gateway_url: Some(format!("ws://localhost:{DEFAULT_GATEWAY_PORT}")),
            reachable: default_port_open,
        });
    }

    let mut docker_claims_default_port = false;
    for gateway in docker_ps() {
        if gateway.host_port == DEFAULT_GATEWAY_PORT {
            docker_claims_default_port = true;
        }

        instances.push(HermesInstance {
            id: format!("docker:{}", gateway.container_id),
            kind: "docker".to_string(),
            label: format!("Docker: {} ({})", gateway.name, gateway.image),
            hermes_bin: None,
            gateway_url: Some(format!("ws://localhost:{}", gateway.host_port)),
            reachable: port_is_open(gateway.host_port),
        });
    }

    if default_port_open && instances.is_empty() && !docker_claims_default_port {
        instances.push(HermesInstance {
            id: format!("running:{DEFAULT_GATEWAY_PORT}"),
            kind: "running".to_string(),
            label: format!("Running gateway on port {DEFAULT_GATEWAY_PORT}"),
            hermes_bin: None,
            gateway_url: Some(format!("ws://localhost:{DEFAULT_GATEWAY_PORT}")),
            reachable: true,
        });
    }

    Ok(instances)
}
