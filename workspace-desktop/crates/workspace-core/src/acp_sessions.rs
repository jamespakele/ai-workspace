//! Long-lived ACP agent sessions (STORY-0009).
//!
//! ACP agents run as persistent child processes reused across prompts,
//! unlike the legacy spawn-per-prompt harnesses. A process-wide
//! SessionManager owns the children so neither the Tauri nor the Axum
//! entrypoint needs to carry new state.

use crate::acp::{AcpClient, PermissionPolicy, PromptOutcome};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};

/// How to start an agent in ACP mode. Built by harness_acp::profile_for.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LaunchProfile {
    pub command: String,
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
}

/// Errors split by whether the caller should fall back to a legacy harness.
#[derive(Debug)]
pub enum AcpError {
    /// Spawn or handshake failed — the agent isn't reachable over ACP.
    Unavailable(String),
    /// The agent is speaking ACP but the operation failed — surface it.
    Failed(String),
}

impl AcpError {
    pub fn message(&self) -> &str {
        match self {
            AcpError::Unavailable(message) | AcpError::Failed(message) => message,
        }
    }
}

/// Transport to a spawned agent: reader, writer, and the child handle when
/// a real process backs it (None for in-memory test transports).
pub type Transport = (Box<dyn Read + Send>, Box<dyn Write + Send>, Option<Child>);

struct ManagedSession {
    client: AcpClient,
    child: Option<Child>,
}

impl Drop for ManagedSession {
    fn drop(&mut self) {
        if let Some(child) = &mut self.child {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[derive(Default)]
pub struct SessionManager {
    sessions: Mutex<HashMap<String, Arc<Mutex<ManagedSession>>>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn global() -> &'static SessionManager {
        static GLOBAL: OnceLock<SessionManager> = OnceLock::new();
        GLOBAL.get_or_init(SessionManager::new)
    }

    /// Send one prompt, reusing a live session when possible.
    ///
    /// Resume semantics: live process → reuse; dead/unknown session id with
    /// loadSession support → respawn + session/load (id preserved);
    /// otherwise a fresh session (new id returned).
    pub fn prompt(
        &self,
        spawner: &dyn Fn(&LaunchProfile) -> Result<Transport, String>,
        profile: &LaunchProfile,
        policy: PermissionPolicy,
        session_id: Option<&str>,
        cwd: &str,
        text: &str,
    ) -> Result<(String, PromptOutcome), AcpError> {
        if let Some(sid) = session_id {
            if let Some(session) = self.live_session(sid) {
                let mut session = session.lock().map_err(poisoned)?;
                let outcome = session.client.prompt(sid, text).map_err(AcpError::Failed)?;
                return Ok((sid.to_string(), outcome));
            }
        }

        // No live process: spawn and establish a session.
        let (reader, writer, child) = spawner(profile).map_err(AcpError::Unavailable)?;
        let mut client =
            AcpClient::connect(reader, writer, policy).map_err(AcpError::Unavailable)?;

        let sid = match session_id {
            Some(sid) if client.caps.load_session => {
                match client.load_session(sid, cwd) {
                    Ok(()) => sid.to_string(),
                    Err(_) => client.new_session(cwd).map_err(AcpError::Failed)?,
                }
            }
            _ => client.new_session(cwd).map_err(AcpError::Failed)?,
        };

        let outcome = client.prompt(&sid, text).map_err(AcpError::Failed)?;

        self.sessions.lock().map_err(poisoned)?.insert(
            sid.clone(),
            Arc::new(Mutex::new(ManagedSession { client, child })),
        );

        Ok((sid, outcome))
    }

    /// Fetch a session if its backing process is still alive; evict it if
    /// the child has exited.
    fn live_session(&self, session_id: &str) -> Option<Arc<Mutex<ManagedSession>>> {
        let mut sessions = self.sessions.lock().ok()?;
        let session = sessions.get(session_id)?.clone();

        let exited = {
            let mut managed = session.lock().ok()?;
            match &mut managed.child {
                Some(child) => child.try_wait().map(|status| status.is_some()).unwrap_or(true),
                None => false, // in-memory transport: assume alive
            }
        };

        if exited {
            sessions.remove(session_id);
            return None;
        }
        Some(session)
    }
}

fn poisoned<T>(_: T) -> AcpError {
    AcpError::Failed("ACP session lock poisoned".to_string())
}

/// Spawn a real agent process for the given launch profile.
pub fn process_spawner(profile: &LaunchProfile) -> Result<Transport, String> {
    let mut command = Command::new(&profile.command);
    command
        .args(&profile.args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    for (key, value) in &profile.env {
        command.env(key, value);
    }

    let mut child = command.spawn().map_err(|e| {
        format!("failed to start ACP agent '{}': {e}", profile.command)
    })?;

    let stdout = child.stdout.take().ok_or("no stdout from ACP agent")?;
    let stdin = child.stdin.take().ok_or("no stdin to ACP agent")?;
    Ok((Box::new(stdout), Box::new(stdin), Some(child)))
}

/// Convenience entrypoint used by harness_acp: global manager + real spawner.
pub fn prompt_via_acp(
    profile: &LaunchProfile,
    policy: PermissionPolicy,
    session_id: Option<&str>,
    cwd: &str,
    text: &str,
) -> Result<(String, PromptOutcome), AcpError> {
    SessionManager::global().prompt(&process_spawner, profile, policy, session_id, cwd, text)
}

// ── Tests ────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::acp::tests::{fake_agent, FakeScript};
    use std::sync::atomic::{AtomicUsize, Ordering};

    fn profile() -> LaunchProfile {
        LaunchProfile {
            command: "fake".to_string(),
            args: Vec::new(),
            env: Vec::new(),
        }
    }

    fn counting_spawner(
        script: FakeScript,
        count: &AtomicUsize,
    ) -> impl Fn(&LaunchProfile) -> Result<Transport, String> + '_ {
        move |_profile| {
            count.fetch_add(1, Ordering::SeqCst);
            let (reader, writer) = fake_agent(script.clone());
            Ok((reader, writer, None))
        }
    }

    #[test]
    fn second_prompt_reuses_the_same_process() {
        let manager = SessionManager::new();
        let count = AtomicUsize::new(0);
        let spawner = counting_spawner(
            FakeScript { chunks: vec!["ok"], ..FakeScript::default() },
            &count,
        );

        let (sid, _) = manager
            .prompt(&spawner, &profile(), PermissionPolicy::RejectAll, None, "/tmp", "one")
            .expect("first prompt");
        let (sid2, outcome) = manager
            .prompt(&spawner, &profile(), PermissionPolicy::RejectAll, Some(&sid), "/tmp", "two")
            .expect("second prompt");

        assert_eq!(sid, sid2);
        assert_eq!(outcome.text, "ok");
        assert_eq!(count.load(Ordering::SeqCst), 1, "should not respawn");
    }

    #[test]
    fn unknown_session_falls_back_to_a_fresh_one() {
        let manager = SessionManager::new();
        let count = AtomicUsize::new(0);
        let spawner = counting_spawner(
            FakeScript { chunks: vec!["fresh"], ..FakeScript::default() },
            &count,
        );

        let (sid, outcome) = manager
            .prompt(&spawner, &profile(), PermissionPolicy::RejectAll, Some("ghost"), "/tmp", "hi")
            .expect("prompt");

        assert_eq!(sid, "sess-1", "agent without loadSession issues a new id");
        assert_eq!(outcome.text, "fresh");
    }

    #[test]
    fn load_session_preserves_the_requested_id() {
        let manager = SessionManager::new();
        let count = AtomicUsize::new(0);
        let spawner = counting_spawner(
            FakeScript { chunks: vec!["restored"], load_session: true, ..FakeScript::default() },
            &count,
        );

        let (sid, outcome) = manager
            .prompt(&spawner, &profile(), PermissionPolicy::RejectAll, Some("ghost"), "/tmp", "hi")
            .expect("prompt");

        assert_eq!(sid, "ghost");
        assert_eq!(outcome.text, "restored");
    }

    #[test]
    fn spawn_failure_is_unavailable_with_command_named() {
        let manager = SessionManager::new();
        let spawner = |_: &LaunchProfile| Err("no such binary claude-agent-acp".to_string());

        let error = manager
            .prompt(&spawner, &profile(), PermissionPolicy::RejectAll, None, "/tmp", "hi")
            .expect_err("should fail");

        match error {
            AcpError::Unavailable(message) => assert!(message.contains("claude-agent-acp")),
            AcpError::Failed(message) => panic!("expected Unavailable, got Failed: {message}"),
        }
    }

    #[test]
    fn fixture_script_round_trips_over_a_real_process() {
        let fixture = format!(
            "{}/tests/fixtures/fake-acp-agent.sh",
            env!("CARGO_MANIFEST_DIR")
        );
        let profile = LaunchProfile {
            command: "sh".to_string(),
            args: vec![fixture],
            env: Vec::new(),
        };

        let manager = SessionManager::new();
        let (sid, outcome) = manager
            .prompt(&process_spawner, &profile, PermissionPolicy::RejectAll, None, "/tmp", "hi")
            .expect("fixture prompt");

        assert_eq!(sid, "fixture-session");
        assert_eq!(outcome.text, "hello from fixture");
    }
}
