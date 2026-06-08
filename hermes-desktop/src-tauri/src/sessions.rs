use serde::Serialize;

#[derive(Debug, Clone, Serialize, Default)]
pub struct SessionSummary {
    pub id: String,
    pub title: String,
    pub model: String,
    pub started_at: f64,
    pub total_tokens: u64,
    pub preview: String,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct Message {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: f64,
}

#[tauri::command]
pub fn list_sessions() -> Result<Vec<SessionSummary>, String> {
    Ok(Vec::new())
}

#[tauri::command]
pub fn get_session_messages(_session_id: String) -> Result<Vec<Message>, String> {
    Ok(Vec::new())
}
