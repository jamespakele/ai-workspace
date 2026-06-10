// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod discovery;
mod fs;
mod harness;
mod harness_claude;
mod harness_codex;
mod harness_gemini;
mod harness_hermes;
mod harness_pi;
mod mcp;
mod projects;
mod scheduled;
mod sessions;
mod skills;
mod workspace;

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
            fs::read_file,
            skills::import_skill,
            skills::list_skills,
            scheduled::list_scheduled_tasks,
            scheduled::save_scheduled_tasks,
            mcp::list_mcp_servers,
            mcp::save_mcp_servers,
            discovery::discover_hermes,
            harness::send_prompt,
            harness::discover_agents,
            workspace::load_workspace,
            workspace::init_workspace,
            workspace::scope_skill_to_project,
            workspace::unscope_skill_from_project,
            workspace::list_global_skills,
            workspace::list_project_skills,
            workspace::install_skill_package,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
