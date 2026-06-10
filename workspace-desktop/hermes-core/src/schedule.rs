//! Persistence model for scheduled tasks (`~/.hermes/scheduled_tasks.json`).
//! Cadence math lives in the frontend (`src/lib/cadence.js`), which runs the
//! due-checker; this module owns durable storage semantics.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ScheduledTask {
    pub id: String,
    pub name: String,
    pub prompt: String,
    /// Cadence spec: `hourly`, `daily@HH:MM`, `weekly:<day>@HH:MM`, `every:<N>m`.
    pub cadence: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// Epoch seconds of the last completed run.
    #[serde(default)]
    pub last_run: Option<i64>,
}

fn default_enabled() -> bool {
    true
}

/// Parse the store file. An empty or missing file is an empty task list.
pub fn parse_tasks(json: &str) -> Result<Vec<ScheduledTask>, String> {
    let trimmed = json.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    serde_json::from_str(trimmed).map_err(|error| error.to_string())
}

pub fn serialize_tasks(tasks: &[ScheduledTask]) -> Result<String, String> {
    serde_json::to_string_pretty(tasks).map_err(|error| error.to_string())
}

/// Insert or replace a task by id, returning the updated list.
pub fn upsert_task(mut tasks: Vec<ScheduledTask>, task: ScheduledTask) -> Vec<ScheduledTask> {
    match tasks.iter_mut().find(|existing| existing.id == task.id) {
        Some(existing) => *existing = task,
        None => tasks.push(task),
    }
    tasks
}

pub fn remove_task(tasks: Vec<ScheduledTask>, id: &str) -> Vec<ScheduledTask> {
    tasks.into_iter().filter(|task| task.id != id).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task(id: &str) -> ScheduledTask {
        ScheduledTask {
            id: id.to_string(),
            name: format!("task {id}"),
            prompt: "do the thing".to_string(),
            cadence: "daily@09:00".to_string(),
            enabled: true,
            last_run: None,
        }
    }

    #[test]
    fn empty_input_parses_to_empty_list() {
        assert_eq!(parse_tasks("").unwrap(), Vec::new());
        assert_eq!(parse_tasks("  \n").unwrap(), Vec::new());
    }

    #[test]
    fn round_trip_preserves_tasks() {
        let tasks = vec![task("a"), task("b")];
        let json = serialize_tasks(&tasks).unwrap();
        assert_eq!(parse_tasks(&json).unwrap(), tasks);
    }

    #[test]
    fn parse_defaults_enabled_and_last_run() {
        let json = r#"[{"id":"x","name":"n","prompt":"p","cadence":"hourly"}]"#;
        let tasks = parse_tasks(json).unwrap();
        assert!(tasks[0].enabled);
        assert_eq!(tasks[0].last_run, None);
    }

    #[test]
    fn parse_rejects_malformed_json() {
        assert!(parse_tasks("{not json").is_err());
    }

    #[test]
    fn upsert_appends_new_task() {
        let tasks = upsert_task(vec![task("a")], task("b"));
        assert_eq!(tasks.len(), 2);
    }

    #[test]
    fn upsert_replaces_existing_task() {
        let mut updated = task("a");
        updated.name = "renamed".to_string();
        updated.last_run = Some(1_700_000_000);

        let tasks = upsert_task(vec![task("a"), task("b")], updated.clone());
        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0], updated);
    }

    #[test]
    fn remove_filters_by_id() {
        let tasks = remove_task(vec![task("a"), task("b")], "a");
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].id, "b");
    }

    #[test]
    fn remove_missing_id_is_noop() {
        let tasks = remove_task(vec![task("a")], "zzz");
        assert_eq!(tasks.len(), 1);
    }
}
