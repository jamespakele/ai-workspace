---
story_id: "STORY-0008"
title: "ACP Client Core (protocol layer)"
status: "COMPLETED"
created_at: "2026-06-11"
updated_at: "2026-06-11"
epic: "ACP adoption (replaces stdout-scraping harnesses)"
---

# Story 8: ACP Client Core

## Story

As the workspace-core crate,
I want a transport-agnostic Agent Client Protocol (ACP) client that speaks
newline-delimited JSON-RPC 2.0,
so that any agent CLI supporting ACP can be driven through one standardized
code path instead of per-CLI flag parsing and stdout scraping.

## Context / Decisions

- ACP (agentclientprotocol.com, Zed) is JSON-RPC 2.0, newline-delimited, over
  the agent process's stdio. We are the *client*; the agent CLI is the *agent*.
- We implement the client by hand on `serde_json` + std threads rather than
  adopting the official async crate: workspace-core is synchronous, the
  protocol subset we need is small, and a sync implementation keeps Tauri and
  Axum integration unchanged.
- The client is written against `Box<dyn Read>` / `Box<dyn Write>` so tests
  drive it with in-memory pipes (`std::io::pipe`) and a scripted fake agent —
  no real agent binaries needed in CI.
- Protocol subset (ACP v1):
  - `initialize` (protocolVersion 1, no fs/terminal client capabilities)
  - `session/new` (cwd, empty mcpServers) → sessionId
  - `session/load` when the agent advertises `loadSession`
  - `session/prompt` (text content block) → stopReason
  - `session/update` notifications: `agent_message_chunk` assembled into the
    response text; `tool_call` / `tool_call_update` / `plan` collected as
    activity lines for future UI use; unknown updates ignored.
  - `session/request_permission` answered by a `PermissionPolicy`
    (default: reject — parity with non-interactive `-p` runs; an allow
    policy exists for config opt-in).
  - Any other agent→client request (e.g. `fs/read_text_file`) is answered
    with JSON-RPC error -32601 (method not found) since we advertise no
    such capabilities.

## Acceptance Criteria

1. New module `crates/workspace-core/src/acp.rs` exporting at minimum:
   `AcpClient`, `PromptOutcome { text, stop_reason, activity }`,
   `PermissionPolicy { RejectAll, AllowAll }`, `AgentCaps { load_session }`.
2. `AcpClient::connect(reader, writer, policy)` performs `initialize` and
   captures agent capabilities.
3. `new_session(cwd)` and `prompt(session_id, text)` round-trip correctly;
   prompt assembles `agent_message_chunk` updates in arrival order.
4. Permission requests are answered without deadlocking the in-flight prompt,
   honoring the policy (RejectAll selects a reject option / cancelled outcome;
   AllowAll selects an allow option).
5. Agent EOF / malformed JSON / JSON-RPC error responses surface as
   `Err(String)` containing the agent's error message.
6. All behavior above covered by `#[cfg(test)]` tests using an in-process
   scripted fake agent over pipes. `cargo test` green.

## Tasks

- [x] **Group A — failing tests first (fake agent harness)**
  - [x] Test helper: scripted fake agent thread over `std::io::pipe` pairs
  - [x] Tests: handshake, new_session, prompt chunk assembly, permission
        policy (reject + allow), unknown agent request → -32601, agent error
        response surfaces, EOF mid-prompt surfaces as error
- [x] **Group B — implementation**
  - [x] Line-delimited JSON-RPC read loop (reader thread + mpsc channel)
  - [x] Request/response correlation by id; notification dispatch
  - [x] `initialize` / `session/new` / `session/load` / `session/prompt`
  - [x] Update accumulation (`agent_message_chunk` → text, tool/plan → activity)
  - [x] Permission + unknown-request responder
- [x] **Group C — verify**: `cargo test` green; no new deps beyond std/serde

## Out of Scope

Process spawning (STORY-0009), per-agent launch profiles and harness routing
(STORY-0010), UI streaming (follow-up epic).
