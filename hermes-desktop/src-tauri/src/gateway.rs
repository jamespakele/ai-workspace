use serde::Serialize;
use std::io::Read;
use std::net::TcpListener;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Connection info returned to the frontend after spawning the gateway.
#[derive(Clone, Serialize)]
pub struct GatewayInfo {
    pub port: u16,
    pub token: String,
    pub ws_url: String,
    pub base_url: String,
}

/// Shared state holding the gateway child process and its connection info.
pub struct GatewayState(pub Mutex<Option<(Child, GatewayInfo)>>);

/// Find an available TCP port by binding to port 0.
fn pick_port() -> Result<u16, String> {
    TcpListener::bind("127.0.0.1:0")
        .map(|listener| listener.local_addr().unwrap().port())
        .map_err(|error| format!("Failed to find an available port: {error}"))
}

/// Generate a random hex token from /dev/urandom.
fn generate_token() -> String {
    let mut bytes = [0u8; 32];
    if let Ok(mut file) = std::fs::File::open("/dev/urandom") {
        let _ = file.read_exact(&mut bytes);
    }
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// Block until the given port accepts TCP connections, or timeout.
fn wait_for_port(port: u16, timeout: Duration) -> Result<(), String> {
    let start = Instant::now();
    let addr: std::net::SocketAddr = format!("127.0.0.1:{port}").parse().unwrap();

    loop {
        if std::net::TcpStream::connect_timeout(&addr, Duration::from_millis(200)).is_ok() {
            return Ok(());
        }

        if start.elapsed() > timeout {
            return Err(format!(
                "Timed out waiting for hermes dashboard on port {port} (waited {}s)",
                timeout.as_secs()
            ));
        }

        std::thread::sleep(Duration::from_millis(300));
    }
}

/// Spawn `hermes dashboard` as the backend gateway process.
///
/// Returns connection info (port, token, ws_url, base_url) that the frontend
/// uses to establish its WebSocket and REST connections.
#[tauri::command]
pub fn spawn_gateway(
    state: tauri::State<GatewayState>,
    hermes_bin: String,
) -> Result<GatewayInfo, String> {
    if hermes_bin.trim().is_empty() {
        return Err("Hermes binary path is empty".to_string());
    }

    let mut guard = state.0.lock().map_err(|error| error.to_string())?;

    // If a gateway is already running, return its existing connection info.
    if let Some((child, info)) = guard.as_mut() {
        match child.try_wait() {
            Ok(Some(_)) => {
                // Process exited — clear state and fall through to spawn a new one.
                *guard = None;
            }
            Ok(None) => return Ok(info.clone()),
            Err(error) => return Err(error.to_string()),
        }
    }

    let port = pick_port()?;
    let token = generate_token();

    let child = Command::new(&hermes_bin)
        .args([
            "dashboard",
            "--no-open",
            "--skip-build",
            "--host",
            "127.0.0.1",
            "--port",
            &port.to_string(),
        ])
        .env("HERMES_DASHBOARD_SESSION_TOKEN", &token)
        .env("HERMES_DESKTOP", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Failed to spawn hermes dashboard: {error}"))?;

    // Wait for the dashboard HTTP server to start accepting connections.
    wait_for_port(port, Duration::from_secs(30))?;

    let info = GatewayInfo {
        port,
        token: token.clone(),
        ws_url: format!("ws://127.0.0.1:{port}/api/ws?token={token}"),
        base_url: format!("http://127.0.0.1:{port}"),
    };

    *guard = Some((child, info.clone()));

    Ok(info)
}

/// Return connection info for the currently running gateway, if any.
#[tauri::command]
pub fn get_gateway_info(state: tauri::State<GatewayState>) -> Result<Option<GatewayInfo>, String> {
    let mut guard = state.0.lock().map_err(|error| error.to_string())?;

    if let Some((child, info)) = guard.as_mut() {
        match child.try_wait() {
            Ok(Some(_)) => {
                *guard = None;
                Ok(None)
            }
            Ok(None) => Ok(Some(info.clone())),
            Err(error) => Err(error.to_string()),
        }
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn kill_gateway(state: tauri::State<GatewayState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|error| error.to_string())?;

    if let Some((mut child, _info)) = guard.take() {
        child.kill().map_err(|error| error.to_string())?;
    }

    Ok(())
}
