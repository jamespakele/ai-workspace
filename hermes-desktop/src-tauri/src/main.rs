// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod fs;
mod gateway;
mod projects;
mod sessions;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
