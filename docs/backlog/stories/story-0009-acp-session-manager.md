---
story_id: "STORY-0009"
title: "ACP Session Manager (long-lived agent processes)"
status: "COMPLETED"
created_at: "2026-06-11"
updated_at: "2026-06-11"
epic: "ACP adoption (replaces stdout-scraping harnesses)"
---

# Story 9: ACP Session Manager

## Story

As the harness layer,
I want ACP agent processes kept alive across prompts and keyed by session id,
so that conversations resume without re-spawning, and the spawn-per-prompt
model required by `-p` flags goes away for ACP agents.

## Context / Decisions

- ACP sessions live as long as the agent process. The legacy harness model is
  spawn-per-prompt with `--resume`; the ACP model is one child process per
  conversation, reused on each prompt.
- A process-wide `SessionManager` (`OnceLock<Mutex<…>>` inside workspace-core)
  owns the children. Neither `src-tauri/main.rs` nor `src-server/main.rs`
  needs new state — minimal downstream surface.
- Keying: the ACP `sessionId` returned by the agent IS the workspace session
  id (stored in `ChatResponse.session_id`, same as today).
- Resume semantics: live process → reuse; dead process + agent advertises
  `loadSession` → respawn + `session/load`; otherwise → new session (new id
  returned, same as legacy harnesses behave when resume fails).
- Spawning is injected (`Spawner` closure returning reader/writer/child
  handles) so manager logic is unit-testable with in-memory fakes; one
  process-level integration test uses a fixture shell script speaking
  canned ACP (deterministic request ids 1,2,3 make this possible).

## Acceptance Criteria

1. New module `crates/workspace-core/src/acp_sessions.rs` with
   `prompt_via_acp(launch: &LaunchProfile, session_id: Option<String>, cwd, text)
   -> Result<(String /*session id*/, PromptOutcome), String>`.
2. Two prompts with the same returned session id hit the SAME child process
   (verified via injected spawner call-count).
3. Dead/unknown session id falls back to a fresh session and returns the new
   id rather than erroring.
4. Spawn failure (missing binary) returns `Err` mentioning the command, so the
   caller can fall back to the legacy harness.
5. Fixture integration test: spawning `tests/fixtures/fake-acp-agent.sh`
   end-to-end produces the scripted response text.
6. `cargo test` green.

## Tasks

- [x] **Group A — failing tests first**
  - [x] Unit tests with injected spawner: reuse, dead-session fallback,
        spawn-failure error
  - [x] Fixture script `fake-acp-agent.sh` + process integration test
- [x] **Group B — implementation**
  - [x] `LaunchProfile { command, args, env, model_flag/model_env }`
  - [x] Global `SessionManager`: HashMap<sessionId, ManagedSession>
  - [x] Reap dead children on access; kill+drop on eviction
- [x] **Group C — verify**: `cargo test` green

## Out of Scope

Idle-timeout eviction and app-exit cleanup hooks (children die with the
parent process; explicit lifecycle hooks are a noted follow-up).
