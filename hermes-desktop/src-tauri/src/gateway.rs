use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

pub struct GatewayState(pub Mutex<Option<Child>>);

#[tauri::command]
pub fn spawn_gateway(state: tauri::State<GatewayState>, hermes_bin: String) -> Result<(), String> {
    if hermes_bin.trim().is_empty() {
        return Err("Hermes binary path is empty".to_string());
    }

    let mut guard = state.0.lock().map_err(|error| error.to_string())?;

    if let Some(child) = guard.as_mut() {
        match child.try_wait() {
            Ok(Some(_)) => {
                *guard = None;
            }
            Ok(None) => return Ok(()),
            Err(error) => return Err(error.to_string()),
        }
    }

    let child = Command::new(hermes_bin)
        .arg("--tui")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| error.to_string())?;

    *guard = Some(child);

    Ok(())
}

#[tauri::command]
pub fn kill_gateway(state: tauri::State<GatewayState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|error| error.to_string())?;

    if let Some(mut child) = guard.take() {
        child.kill().map_err(|error| error.to_string())?;
    }

    Ok(())
}
