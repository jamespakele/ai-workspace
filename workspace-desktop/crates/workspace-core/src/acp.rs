//! Agent Client Protocol (ACP) client.
//!
//! Implements the client side of ACP v1 (agentclientprotocol.com):
//! newline-delimited JSON-RPC 2.0 over an agent process's stdio. The
//! transport is abstracted behind Read/Write so tests can drive the
//! protocol over in-memory pipes (see STORY-0008).

use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Read, Write};
use std::sync::mpsc;

pub const PROTOCOL_VERSION: u64 = 1;

/// How to answer `session/request_permission` without a UI in the loop.
/// RejectAll mirrors the old non-interactive `-p` behavior; AllowAll is the
/// config opt-in (`acp_auto_approve`).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PermissionPolicy {
    RejectAll,
    AllowAll,
}

#[derive(Clone, Copy, Default, Debug)]
pub struct AgentCaps {
    pub load_session: bool,
}

/// The assembled result of one `session/prompt` round.
#[derive(Clone, Debug, Default)]
pub struct PromptOutcome {
    /// Concatenated `agent_message_chunk` text, in arrival order.
    pub text: String,
    pub stop_reason: String,
    /// Human-readable lines for tool calls / plans observed during the turn.
    pub activity: Vec<String>,
}

pub struct AcpClient {
    writer: Box<dyn Write + Send>,
    incoming: mpsc::Receiver<Result<Value, String>>,
    next_id: u64,
    policy: PermissionPolicy,
    updates: Vec<Value>,
    pub caps: AgentCaps,
}

impl AcpClient {
    /// Perform the `initialize` handshake over the given transport.
    pub fn connect(
        reader: Box<dyn Read + Send>,
        writer: Box<dyn Write + Send>,
        policy: PermissionPolicy,
    ) -> Result<Self, String> {
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            let mut lines = BufReader::new(reader).lines();
            while let Some(line) = lines.next() {
                let item = match line {
                    Ok(line) if line.trim().is_empty() => continue,
                    Ok(line) => serde_json::from_str::<Value>(&line)
                        .map_err(|e| format!("malformed JSON from agent: {e}")),
                    Err(e) => Err(format!("failed reading from agent: {e}")),
                };
                let failed = item.is_err();
                if tx.send(item).is_err() || failed {
                    break;
                }
            }
        });

        let mut client = AcpClient {
            writer,
            incoming: rx,
            next_id: 0,
            policy,
            updates: Vec::new(),
            caps: AgentCaps::default(),
        };

        let result = client.request(
            "initialize",
            json!({
                "protocolVersion": PROTOCOL_VERSION,
                "clientCapabilities": {
                    "fs": { "readTextFile": false, "writeTextFile": false }
                }
            }),
        )?;

        client.caps.load_session = result["agentCapabilities"]["loadSession"]
            .as_bool()
            .unwrap_or(false);

        Ok(client)
    }

    /// Create a new session; returns the agent-issued session id.
    pub fn new_session(&mut self, cwd: &str) -> Result<String, String> {
        let result = self.request(
            "session/new",
            json!({ "cwd": cwd, "mcpServers": [] }),
        )?;
        result["sessionId"]
            .as_str()
            .map(ToOwned::to_owned)
            .ok_or_else(|| "agent returned no sessionId".to_string())
    }

    /// Replay an existing session (only valid when caps.load_session).
    pub fn load_session(&mut self, session_id: &str, cwd: &str) -> Result<(), String> {
        self.request(
            "session/load",
            json!({ "sessionId": session_id, "cwd": cwd, "mcpServers": [] }),
        )?;
        Ok(())
    }

    /// Send one user prompt and assemble streamed updates into an outcome.
    pub fn prompt(&mut self, session_id: &str, text: &str) -> Result<PromptOutcome, String> {
        self.updates.clear();
        let result = self.request(
            "session/prompt",
            json!({
                "sessionId": session_id,
                "prompt": [{ "type": "text", "text": text }]
            }),
        )?;

        let mut outcome = PromptOutcome {
            stop_reason: result["stopReason"].as_str().unwrap_or_default().to_string(),
            ..PromptOutcome::default()
        };

        for update in self.updates.drain(..) {
            match update["sessionUpdate"].as_str().unwrap_or_default() {
                "agent_message_chunk" => {
                    if update["content"]["type"] == "text" {
                        outcome
                            .text
                            .push_str(update["content"]["text"].as_str().unwrap_or_default());
                    }
                }
                "tool_call" => {
                    let title = update["title"]
                        .as_str()
                        .or_else(|| update["toolCallId"].as_str())
                        .unwrap_or("unknown");
                    outcome.activity.push(format!("tool_call: {title}"));
                }
                "tool_call_update" => {
                    let status = update["status"].as_str().unwrap_or("update");
                    outcome.activity.push(format!("tool_call_update: {status}"));
                }
                "plan" => outcome.activity.push("plan".to_string()),
                _ => {}
            }
        }

        Ok(outcome)
    }

    // ── JSON-RPC plumbing ─────────────────────────────────────

    fn send_message(&mut self, message: &Value) -> Result<(), String> {
        let mut line = serde_json::to_string(message)
            .map_err(|e| format!("failed to encode message: {e}"))?;
        line.push('\n');
        self.writer
            .write_all(line.as_bytes())
            .and_then(|()| self.writer.flush())
            .map_err(|e| format!("failed writing to agent: {e}"))
    }

    /// Send a request and pump incoming messages until its response arrives.
    /// Agent-initiated requests (permissions) and notifications received in
    /// the meantime are handled inline so the agent never deadlocks on us.
    fn request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        self.next_id += 1;
        let id = self.next_id;
        self.send_message(&json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params
        }))?;

        loop {
            let message = self
                .incoming
                .recv()
                .map_err(|_| "agent closed the connection".to_string())??;

            if message.get("method").is_some() {
                if message.get("id").is_some() {
                    self.answer_agent_request(&message)?;
                } else if message["method"] == "session/update" {
                    self.updates.push(message["params"]["update"].clone());
                }
                continue;
            }

            if message["id"] == json!(id) {
                if let Some(error) = message.get("error") {
                    let detail = error["message"].as_str().unwrap_or("unknown error");
                    return Err(format!("agent error on {method}: {detail}"));
                }
                return Ok(message["result"].clone());
            }
            // Stray response for an id we no longer track — ignore.
        }
    }

    fn answer_agent_request(&mut self, message: &Value) -> Result<(), String> {
        let id = message["id"].clone();
        let response = match message["method"].as_str().unwrap_or_default() {
            "session/request_permission" => {
                let outcome = choose_permission(&message["params"]["options"], self.policy);
                json!({ "jsonrpc": "2.0", "id": id, "result": { "outcome": outcome } })
            }
            other => json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32601, "message": format!("method not found: {other}") }
            }),
        };
        self.send_message(&response)
    }
}

/// Pick a permission option per policy. Falls back to a cancelled outcome
/// when no option of the desired kind exists.
fn choose_permission(options: &Value, policy: PermissionPolicy) -> Value {
    let options = options.as_array().cloned().unwrap_or_default();
    let wanted = match policy {
        PermissionPolicy::AllowAll => "allow",
        PermissionPolicy::RejectAll => "reject",
    };

    let pick = options
        .iter()
        .find(|option| {
            option["kind"]
                .as_str()
                .map(|kind| kind.starts_with(wanted))
                .unwrap_or(false)
        })
        .or(if policy == PermissionPolicy::AllowAll {
            options.first()
        } else {
            None
        });

    match pick.and_then(|option| option["optionId"].as_str()) {
        Some(option_id) => json!({ "outcome": "selected", "optionId": option_id }),
        None => json!({ "outcome": "cancelled" }),
    }
}

// ── Tests ────────────────────────────────────────────────────

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use std::io::pipe;

    /// What the scripted fake agent should do when it receives a prompt.
    #[derive(Clone, Default)]
    pub(crate) struct FakeScript {
        pub chunks: Vec<&'static str>,
        pub request_permission: bool,
        pub probe_fs: bool,
        pub error_on_prompt: bool,
        pub die_mid_prompt: bool,
        pub tool_call: bool,
        pub load_session: bool,
    }

    /// Spawn an in-process fake ACP agent over anonymous pipes. Returns the
    /// client's transport ends.
    pub(crate) fn fake_agent(
        script: FakeScript,
    ) -> (Box<dyn Read + Send>, Box<dyn Write + Send>) {
        let (client_reads, agent_writes) = pipe().expect("pipe");
        let (agent_reads, client_writes) = pipe().expect("pipe");

        std::thread::spawn(move || {
            let mut writer = agent_writes;
            let reader = BufReader::new(agent_reads);
            let mut lines = reader.lines();

            let mut next_line = || -> Option<Value> {
                let line = lines.next()?.ok()?;
                serde_json::from_str(&line).ok()
            };

            let mut emit = |value: Value| {
                let mut line = value.to_string();
                line.push('\n');
                let _ = writer.write_all(line.as_bytes());
                let _ = writer.flush();
            };

            while let Some(message) = next_line() {
                let id = message["id"].clone();
                match message["method"].as_str().unwrap_or_default() {
                    "initialize" => emit(json!({
                        "jsonrpc": "2.0", "id": id,
                        "result": {
                            "protocolVersion": PROTOCOL_VERSION,
                            "agentCapabilities": { "loadSession": script.load_session }
                        }
                    })),
                    "session/new" => emit(json!({
                        "jsonrpc": "2.0", "id": id,
                        "result": { "sessionId": "sess-1" }
                    })),
                    "session/load" => emit(json!({
                        "jsonrpc": "2.0", "id": id, "result": {}
                    })),
                    "session/prompt" => {
                        let session_id = message["params"]["sessionId"].clone();
                        let update = |update: Value| {
                            json!({
                                "jsonrpc": "2.0", "method": "session/update",
                                "params": { "sessionId": session_id, "update": update }
                            })
                        };

                        if script.error_on_prompt {
                            emit(json!({
                                "jsonrpc": "2.0", "id": id,
                                "error": { "code": -32000, "message": "boom" }
                            }));
                            continue;
                        }

                        if script.request_permission {
                            emit(json!({
                                "jsonrpc": "2.0", "id": 100,
                                "method": "session/request_permission",
                                "params": { "options": [
                                    { "optionId": "a", "kind": "allow_once", "name": "Allow" },
                                    { "optionId": "r", "kind": "reject_once", "name": "Reject" }
                                ]}
                            }));
                            let answer = next_line().unwrap_or_default();
                            let chosen = answer["result"]["outcome"]["optionId"]
                                .as_str()
                                .unwrap_or("cancelled")
                                .to_string();
                            emit(update(json!({
                                "sessionUpdate": "agent_message_chunk",
                                "content": { "type": "text", "text": format!("perm:{chosen}") }
                            })));
                        }

                        if script.probe_fs {
                            emit(json!({
                                "jsonrpc": "2.0", "id": 101,
                                "method": "fs/read_text_file",
                                "params": { "path": "/etc/passwd" }
                            }));
                            let answer = next_line().unwrap_or_default();
                            let code = answer["error"]["code"].as_i64().unwrap_or(0);
                            emit(update(json!({
                                "sessionUpdate": "agent_message_chunk",
                                "content": { "type": "text", "text": format!("fserr:{code}") }
                            })));
                        }

                        if script.tool_call {
                            emit(update(json!({
                                "sessionUpdate": "tool_call",
                                "toolCallId": "t1", "title": "read file"
                            })));
                            emit(update(json!({
                                "sessionUpdate": "tool_call_update",
                                "toolCallId": "t1", "status": "completed"
                            })));
                        }

                        for chunk in &script.chunks {
                            emit(update(json!({
                                "sessionUpdate": "agent_message_chunk",
                                "content": { "type": "text", "text": *chunk }
                            })));
                        }

                        if script.die_mid_prompt {
                            return; // drop writer: client sees EOF
                        }

                        emit(json!({
                            "jsonrpc": "2.0", "id": id,
                            "result": { "stopReason": "end_turn" }
                        }));
                    }
                    _ => emit(json!({
                        "jsonrpc": "2.0", "id": id,
                        "error": { "code": -32601, "message": "method not found" }
                    })),
                }
            }
        });

        (Box::new(client_reads), Box::new(client_writes))
    }

    fn connect(script: FakeScript, policy: PermissionPolicy) -> AcpClient {
        let (reader, writer) = fake_agent(script);
        AcpClient::connect(reader, writer, policy).expect("handshake")
    }

    #[test]
    fn handshake_captures_agent_capabilities() {
        let client = connect(
            FakeScript { load_session: true, ..FakeScript::default() },
            PermissionPolicy::RejectAll,
        );
        assert!(client.caps.load_session);

        let client = connect(FakeScript::default(), PermissionPolicy::RejectAll);
        assert!(!client.caps.load_session);
    }

    #[test]
    fn prompt_assembles_chunks_in_order() {
        let mut client = connect(
            FakeScript { chunks: vec!["Hello, ", "world."], ..FakeScript::default() },
            PermissionPolicy::RejectAll,
        );
        let session = client.new_session("/tmp").expect("session");
        assert_eq!(session, "sess-1");

        let outcome = client.prompt(&session, "hi").expect("prompt");
        assert_eq!(outcome.text, "Hello, world.");
        assert_eq!(outcome.stop_reason, "end_turn");
    }

    #[test]
    fn reject_policy_selects_reject_option() {
        let mut client = connect(
            FakeScript { request_permission: true, ..FakeScript::default() },
            PermissionPolicy::RejectAll,
        );
        let session = client.new_session("/tmp").expect("session");
        let outcome = client.prompt(&session, "hi").expect("prompt");
        assert!(outcome.text.contains("perm:r"), "got: {}", outcome.text);
    }

    #[test]
    fn allow_policy_selects_allow_option() {
        let mut client = connect(
            FakeScript { request_permission: true, ..FakeScript::default() },
            PermissionPolicy::AllowAll,
        );
        let session = client.new_session("/tmp").expect("session");
        let outcome = client.prompt(&session, "hi").expect("prompt");
        assert!(outcome.text.contains("perm:a"), "got: {}", outcome.text);
    }

    #[test]
    fn unknown_agent_request_gets_method_not_found() {
        let mut client = connect(
            FakeScript { probe_fs: true, ..FakeScript::default() },
            PermissionPolicy::RejectAll,
        );
        let session = client.new_session("/tmp").expect("session");
        let outcome = client.prompt(&session, "hi").expect("prompt");
        assert!(outcome.text.contains("fserr:-32601"), "got: {}", outcome.text);
    }

    #[test]
    fn tool_calls_are_collected_as_activity() {
        let mut client = connect(
            FakeScript { tool_call: true, chunks: vec!["done"], ..FakeScript::default() },
            PermissionPolicy::RejectAll,
        );
        let session = client.new_session("/tmp").expect("session");
        let outcome = client.prompt(&session, "hi").expect("prompt");
        assert!(outcome.activity.iter().any(|line| line.contains("read file")));
        assert!(outcome.activity.iter().any(|line| line.contains("completed")));
    }

    #[test]
    fn agent_error_response_surfaces() {
        let mut client = connect(
            FakeScript { error_on_prompt: true, ..FakeScript::default() },
            PermissionPolicy::RejectAll,
        );
        let session = client.new_session("/tmp").expect("session");
        let error = client.prompt(&session, "hi").expect_err("should fail");
        assert!(error.contains("boom"), "got: {error}");
    }

    #[test]
    fn eof_mid_prompt_surfaces_as_error() {
        let mut client = connect(
            FakeScript { die_mid_prompt: true, chunks: vec!["partial"], ..FakeScript::default() },
            PermissionPolicy::RejectAll,
        );
        let session = client.new_session("/tmp").expect("session");
        let error = client.prompt(&session, "hi").expect_err("should fail");
        assert!(error.contains("closed"), "got: {error}");
    }
}
