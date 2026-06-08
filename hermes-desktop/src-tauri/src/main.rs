// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod fs;
mod gateway;
mod projects;
mod sessions;

use gateway::GatewayState;
use std::sync::Mutex;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(GatewayState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            sessions::list_sessions,
            sessions::get_session_messages,
            config::get_config,
            config::save_config,
            projects::list_projects,
            projects::add_project,
            fs::read_dir,
            gateway::spawn_gateway,
            gateway::kill_gateway,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<GatewayState>();
                let child_to_kill = match state.0.lock() {
                    Ok(mut guard) => guard.take(),
                    Err(_) => None,
                };

                if let Some(mut child) = child_to_kill {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
