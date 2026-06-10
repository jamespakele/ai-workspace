// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use workspace_core::{config, discovery, fs, harness, mcp, projects, scheduled, sessions, skills, workspace};

// ── Thin #[tauri::command] wrappers that delegate to workspace_core ──

#[tauri::command]
fn list_sessions() -> Result<Vec<sessions::SessionSummary>, String> {
    sessions::list_sessions()
}

#[tauri::command]
fn get_session_messages(session_id: String) -> Result<Vec<sessions::Message>, String> {
    sessions::get_session_messages(session_id)
}

#[tauri::command]
fn get_config() -> Result<config::AppConfig, String> {
    config::get_config()
}

#[tauri::command]
fn save_config(config: config::AppConfig) -> Result<(), String> {
    config::save_config(config)
}

#[tauri::command]
fn list_projects() -> Result<Vec<projects::Project>, String> {
    projects::list_projects()
}

#[tauri::command]
fn add_project(path: String) -> Result<(), String> {
    projects::add_project(path)
}

#[tauri::command]
fn read_dir(path: String) -> Result<Vec<fs::DirEntry>, String> {
    fs::read_dir(path)
}

#[tauri::command]
fn read_file(path: String) -> Result<fs::FilePreview, String> {
    fs::read_file(path)
}

#[tauri::command]
fn import_skill(path: String) -> Result<skills::SkillImportResult, String> {
    skills::import_skill(path)
}

#[tauri::command]
fn list_skills() -> Result<Vec<skills::SkillImportResult>, String> {
    skills::list_skills()
}

#[tauri::command]
fn list_scheduled_tasks() -> Result<Vec<scheduled::ScheduledTask>, String> {
    scheduled::list_scheduled_tasks()
}

#[tauri::command]
fn save_scheduled_tasks(tasks: Vec<scheduled::ScheduledTask>) -> Result<(), String> {
    scheduled::save_scheduled_tasks(tasks)
}

#[tauri::command]
fn list_mcp_servers() -> Result<Vec<mcp::McpServer>, String> {
    mcp::list_mcp_servers()
}

#[tauri::command]
fn save_mcp_servers(servers: Vec<mcp::McpServer>) -> Result<(), String> {
    mcp::save_mcp_servers(servers)
}

#[tauri::command]
fn discover_hermes() -> Result<Vec<discovery::HermesInstance>, String> {
    discovery::discover_hermes()
}

#[tauri::command]
async fn send_prompt(
    agent: Option<String>,
    hermes_bin: Option<String>,
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
    model: Option<String>,
) -> Result<harness::ChatResponse, String> {
    // Run on a background thread so we don't freeze the UI
    tokio::task::spawn_blocking(move || {
        harness::send_prompt(agent, hermes_bin, text, session_id, cwd, model)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
fn discover_agents() -> Vec<harness::AgentInfo> {
    harness::discover_agents()
}

#[tauri::command]
fn list_models() -> Vec<String> {
    harness::list_models()
}

#[tauri::command]
fn load_workspace(project_dir: Option<String>) -> workspace::WorkspaceContext {
    workspace::load_workspace(project_dir)
}

#[tauri::command]
fn init_workspace() -> Result<String, String> {
    workspace::init_workspace()
}

#[tauri::command]
fn scope_skill_to_project(skill_name: String, project_dir: String) -> Result<(), String> {
    workspace::scope_skill_to_project(skill_name, project_dir)
}

#[tauri::command]
fn unscope_skill_from_project(skill_name: String, project_dir: String) -> Result<(), String> {
    workspace::unscope_skill_from_project(skill_name, project_dir)
}

#[tauri::command]
fn list_global_skills() -> Vec<workspace::SkillInfo> {
    workspace::list_global_skills()
}

#[tauri::command]
fn list_project_skills(project_dir: String) -> Vec<workspace::SkillInfo> {
    workspace::list_project_skills(project_dir)
}

#[tauri::command]
fn install_skill_package(file_path: String) -> Result<String, String> {
    workspace::install_skill_package(file_path)
}

#[tauri::command]
fn browse_roots() -> Vec<fs::DirEntry> {
    fs::browse_roots()
}

#[tauri::command]
fn read_dir_browsable(path: String) -> Result<Vec<fs::DirEntry>, String> {
    fs::read_dir_browsable(path)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            list_sessions,
            get_session_messages,
            get_config,
            save_config,
            list_projects,
            add_project,
            read_dir,
            read_file,
            browse_roots,
            read_dir_browsable,
            import_skill,
            list_skills,
            list_scheduled_tasks,
            save_scheduled_tasks,
            list_mcp_servers,
            save_mcp_servers,
            discover_hermes,
            send_prompt,
            discover_agents,
            list_models,
            load_workspace,
            init_workspace,
            scope_skill_to_project,
            unscope_skill_from_project,
            list_global_skills,
            list_project_skills,
            install_skill_package,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

