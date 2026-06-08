use serde::Serialize;
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::{Row, SqlitePool};
use std::env;

const SESSION_LIST_SQL: &str = r#"
SELECT
    s.id,
    s.title,
    s.model,
    s.started_at,
    s.input_tokens + s.output_tokens AS total_tokens,
    COALESCE(
        (SELECT SUBSTR(m.content, 1, 63)
         FROM messages m
         WHERE m.session_id = s.id AND m.role = 'user' AND m.content IS NOT NULL
         ORDER BY m.timestamp, m.id LIMIT 1),
        ''
    ) AS preview
FROM sessions s
WHERE s.source = 'cli'
ORDER BY s.started_at DESC
LIMIT 50
"#;

#[derive(Debug, Clone, Serialize, Default)]
pub struct SessionSummary {
    pub id: String,
    pub title: String,
    pub model: String,
    pub started_at: f64,
    pub total_tokens: i64,
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
pub async fn list_sessions() -> Result<Vec<SessionSummary>, String> {
    let home = dirs::home_dir()
        .or_else(|| env::var_os("HOME").map(Into::into))
        .ok_or_else(|| "Cannot determine home directory".to_string())?;
    let db_path = home.join(".hermes").join("state.db");

    if !db_path.exists() {
        return Ok(Vec::new());
    }

    let options = SqliteConnectOptions::new()
        .filename(&db_path)
        .read_only(true);

    let pool = SqlitePool::connect_with(options)
        .await
        .map_err(|error| error.to_string())?;
    let rows = sqlx::query(SESSION_LIST_SQL)
        .fetch_all(&pool)
        .await
        .map_err(|error| error.to_string())?;

    let sessions = rows
        .into_iter()
        .map(|row| SessionSummary {
            id: row.try_get::<String, _>("id").unwrap_or_default(),
            title: row
                .try_get::<Option<String>, _>("title")
                .ok()
                .flatten()
                .unwrap_or_default(),
            model: row
                .try_get::<Option<String>, _>("model")
                .ok()
                .flatten()
                .unwrap_or_default(),
            started_at: row.try_get::<f64, _>("started_at").unwrap_or(0.0),
            total_tokens: row.try_get::<i64, _>("total_tokens").unwrap_or(0),
            preview: row.try_get::<String, _>("preview").unwrap_or_default(),
        })
        .collect();

    pool.close().await;

    Ok(sessions)
}

#[tauri::command]
pub fn get_session_messages(_session_id: String) -> Result<Vec<Message>, String> {
    Ok(Vec::new())
}
