#[tauri::command]
pub fn spawn_gateway() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn kill_gateway() -> Result<(), String> {
    Ok(())
}
