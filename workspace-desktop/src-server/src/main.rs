use axum::{
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::{delete, get, post},
    Router,
};
use serde::Deserialize;
use std::net::SocketAddr;
use tower_http::services::ServeDir;

// ── Request types ────────────────────────────────────────────

#[derive(Deserialize)]
struct SendPromptRequest {
    agent: Option<String>,
    hermes_bin: Option<String>,
    text: String,
    session_id: Option<String>,
    cwd: Option<String>,
    model: Option<String>,
}

#[derive(Deserialize)]
struct PathRequest {
    path: String,
}

#[derive(Deserialize)]
struct ScopeRequest {
    skill_name: String,
    project_dir: String,
}

#[derive(Deserialize)]
struct ProjectDirRequest {
    project_dir: String,
}

#[derive(Deserialize)]
struct ProjectDirQuery {
    project_dir: Option<String>,
}

#[derive(Deserialize)]
struct InstallRequest {
    file_path: String,
}

// ── Helpers ──────────────────────────────────────────────────

fn err_to_response(e: String) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e)
}

// ── Route handlers ───────────────────────────────────────────

async fn handle_send_prompt(
    Json(req): Json<SendPromptRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Run on a background thread so we don't block the async runtime
    let result = tokio::task::spawn_blocking(move || {
        workspace_core::harness::send_prompt(
            req.agent,
            req.hermes_bin,
            req.text,
            req.session_id,
            req.cwd,
            req.model,
        )
    })
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Task join error: {e}")))?
    .map_err(err_to_response)?;

    Ok(Json(result))
}

async fn handle_discover_agents() -> impl IntoResponse {
    Json(workspace_core::harness::discover_agents())
}

async fn handle_list_models() -> impl IntoResponse {
    Json(workspace_core::harness::list_models())
}

async fn handle_discover_hermes() -> Result<impl IntoResponse, (StatusCode, String)> {
    let result = workspace_core::discovery::discover_hermes().map_err(err_to_response)?;
    Ok(Json(result))
}

async fn handle_get_config() -> Result<impl IntoResponse, (StatusCode, String)> {
    let result = workspace_core::config::get_config().map_err(err_to_response)?;
    Ok(Json(result))
}

async fn handle_save_config(
    Json(config): Json<workspace_core::config::AppConfig>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    workspace_core::config::save_config(config).map_err(err_to_response)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn handle_list_projects() -> Result<impl IntoResponse, (StatusCode, String)> {
    let result = workspace_core::projects::list_projects().map_err(err_to_response)?;
    Ok(Json(result))
}

async fn handle_add_project(
    Json(req): Json<PathRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    workspace_core::projects::add_project(req.path).map_err(err_to_response)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn handle_read_dir(
    Json(req): Json<PathRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let result = workspace_core::fs::read_dir(req.path).map_err(err_to_response)?;
    Ok(Json(result))
}

async fn handle_read_file(
    Json(req): Json<PathRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let result = workspace_core::fs::read_file(req.path).map_err(err_to_response)?;
    Ok(Json(result))
}

async fn handle_browse_roots() -> impl IntoResponse {
    Json(workspace_core::fs::browse_roots())
}

async fn handle_read_dir_browsable(
    Json(req): Json<PathRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let result = workspace_core::fs::read_dir_browsable(req.path).map_err(err_to_response)?;
    Ok(Json(result))
}

async fn handle_list_sessions() -> Result<impl IntoResponse, (StatusCode, String)> {
    let result = workspace_core::sessions::list_sessions().map_err(err_to_response)?;
    Ok(Json(result))
}

async fn handle_list_skills() -> Result<impl IntoResponse, (StatusCode, String)> {
    let result = workspace_core::skills::list_skills().map_err(err_to_response)?;
    Ok(Json(result))
}

async fn handle_list_scheduled_tasks() -> Result<impl IntoResponse, (StatusCode, String)> {
    let result = workspace_core::scheduled::list_scheduled_tasks().map_err(err_to_response)?;
    Ok(Json(result))
}

async fn handle_save_scheduled_tasks(
    Json(tasks): Json<Vec<workspace_core::scheduled::ScheduledTask>>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    workspace_core::scheduled::save_scheduled_tasks(tasks).map_err(err_to_response)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn handle_list_mcp_servers() -> Result<impl IntoResponse, (StatusCode, String)> {
    let result = workspace_core::mcp::list_mcp_servers().map_err(err_to_response)?;
    Ok(Json(result))
}

async fn handle_save_mcp_servers(
    Json(servers): Json<Vec<workspace_core::mcp::McpServer>>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    workspace_core::mcp::save_mcp_servers(servers).map_err(err_to_response)?;
    Ok(StatusCode::NO_CONTENT)
}

// Workspace endpoints

async fn handle_load_workspace(
    Json(req): Json<ProjectDirQuery>,
) -> impl IntoResponse {
    Json(workspace_core::workspace::load_workspace(req.project_dir))
}

async fn handle_init_workspace() -> Result<impl IntoResponse, (StatusCode, String)> {
    let result = workspace_core::workspace::init_workspace().map_err(err_to_response)?;
    Ok(Json(result))
}

async fn handle_scope_skill(
    Json(req): Json<ScopeRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    workspace_core::workspace::scope_skill_to_project(req.skill_name, req.project_dir)
        .map_err(err_to_response)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn handle_unscope_skill(
    Json(req): Json<ScopeRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    workspace_core::workspace::unscope_skill_from_project(req.skill_name, req.project_dir)
        .map_err(err_to_response)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn handle_list_global_skills() -> impl IntoResponse {
    Json(workspace_core::workspace::list_global_skills())
}

async fn handle_list_project_skills(
    Json(req): Json<ProjectDirRequest>,
) -> impl IntoResponse {
    Json(workspace_core::workspace::list_project_skills(req.project_dir))
}

async fn handle_install_skill_package(
    Json(req): Json<InstallRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let result = workspace_core::workspace::install_skill_package(req.file_path)
        .map_err(err_to_response)?;
    Ok(Json(result))
}

// ── Main ─────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3000);

    // Serve static files from dist/ (Vite build output)
    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "dist".to_string());

    let api_routes = Router::new()
        // Harness
        .route("/api/send_prompt", post(handle_send_prompt))
        .route("/api/discover_agents", get(handle_discover_agents))
        .route("/api/models", get(handle_list_models))
        .route("/api/discover_hermes", get(handle_discover_hermes))
        // Config
        .route("/api/config", get(handle_get_config))
        .route("/api/config", post(handle_save_config))
        // Projects
        .route("/api/projects", get(handle_list_projects))
        .route("/api/projects", post(handle_add_project))
        // Filesystem
        .route("/api/fs/read_dir", post(handle_read_dir))
        .route("/api/fs/read_file", post(handle_read_file))
        .route("/api/fs/browse_roots", get(handle_browse_roots))
        .route("/api/fs/read_dir_browsable", post(handle_read_dir_browsable))
        // Sessions
        .route("/api/sessions", get(handle_list_sessions))
        // Skills
        .route("/api/skills", get(handle_list_skills))
        // Scheduled tasks
        .route("/api/scheduled", get(handle_list_scheduled_tasks))
        .route("/api/scheduled", post(handle_save_scheduled_tasks))
        // MCP
        .route("/api/mcp", get(handle_list_mcp_servers))
        .route("/api/mcp", post(handle_save_mcp_servers))
        // Workspace
        .route("/api/workspace", post(handle_load_workspace))
        .route("/api/workspace/init", post(handle_init_workspace))
        .route("/api/workspace/skills/scope", post(handle_scope_skill))
        .route("/api/workspace/skills/scope", delete(handle_unscope_skill))
        .route("/api/workspace/skills/global", get(handle_list_global_skills))
        .route("/api/workspace/skills/project", post(handle_list_project_skills))
        .route("/api/workspace/skills/install", post(handle_install_skill_package));

    let app = api_routes.fallback_service(ServeDir::new(&static_dir));

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("workspace-server listening on http://{addr}");
    println!("Static files: {static_dir}");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
