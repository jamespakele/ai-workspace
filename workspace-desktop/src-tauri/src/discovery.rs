use std::net::{SocketAddr, TcpStream};
use std::process::Command;
use std::time::Duration;

use hermes_core::discovery::{
    candidate_binary_paths, dedupe_paths, parse_docker_ps, parse_which_output,
    DEFAULT_GATEWAY_PORT,
};

const PROBE_TIMEOUT: Duration = Duration::from_millis(300);

#[derive(Debug, Clone, serde::Serialize)]
pub struct HermesInstance {
    pub id: String,
    /// "binary" (installed executable), "docker" (running container), or
    /// "running" (a gateway already listening that nothing else explains).
    pub kind: String,
    pub label: String,
    pub hermes_bin: Option<String>,
    pub gateway_url: Option<String>,
    pub reachable: bool,
}

fn port_is_open(port: u16) -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&address, PROBE_TIMEOUT).is_ok()
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

fn docker_ps() -> Vec<hermes_core::discovery::DockerGateway> {
    Command::new("docker")
        .args(["ps", "--format", "{{json .}}"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|stdout| parse_docker_ps(&stdout))
        .unwrap_or_default()
}

#[tauri::command]
pub fn discover_hermes() -> Result<Vec<HermesInstance>, String> {
    let mut instances = Vec::new();

    // Installed binaries: PATH plus conventional locations.
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

    // Running docker containers publishing a gateway port.
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

    // A live gateway on the default port that no binary or container above
    // accounts for (e.g. started manually in a terminal).
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
