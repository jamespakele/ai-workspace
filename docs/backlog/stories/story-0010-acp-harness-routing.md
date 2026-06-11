---
story_id: "STORY-0010"
title: "ACP Harness + Per-Agent Routing with Legacy Fallback"
status: "COMPLETED"
created_at: "2026-06-11"
updated_at: "2026-06-11"
epic: "ACP adoption (replaces stdout-scraping harnesses)"
---

# Story 10: ACP Harness and Routing

## Story

As a user picking any agent in the composer,
I want ACP used automatically for agents that support it, with silent
fallback to the existing flag-based harness when ACP isn't available,
so that the standardized path is the default going forward without breaking
any agent that lacks ACP support.

## Context / Decisions

- Default launch profiles (each overridable via config, since exact
  binaries/flags vary per machine and per release — verify-on-machine):
  | agent  | default ACP launch                          | model passing        |
  |--------|---------------------------------------------|----------------------|
  | claude | `claude-agent-acp` (Zed adapter, npm)        | `ANTHROPIC_MODEL` env|
  | gemini | `gemini --experimental-acp`                  | `-m <model>` arg     |
  | codex  | `codex-acp` (Zed adapter)                    | none (agent default) |
  | goose  | `goose acp`                                  | none                 |
- `antigravity` (`agy`) ACP support is unconfirmed post Gemini-CLI cutover;
  no default profile — users can add one via config override once verified.
- hermes, ollama, pi, aider, amp have no ACP support: permanently legacy.
- Routing rule in `send_prompt`: if `config.acp_enabled` (default ON) and the
  agent has a profile (default or override) → try ACP; on `Err` from
  spawn/handshake → fall back to the legacy harness for that agent. ACP
  prompt-level errors after a successful handshake are surfaced, not
  swallowed by fallback.
- The soul/os/skills context prefix is prepended to the prompt text exactly
  as for legacy harnesses — no behavior change in workspace context.

## Acceptance Criteria

1. New module `crates/workspace-core/src/harness_acp.rs` exporting
   `profile_for(agent, &AppConfig, model) -> Option<LaunchProfile>`,
   `route(agent, &AppConfig, model) -> Route`, and
   `send(agent, &LaunchProfile, &AppConfig, text, session_id, cwd)
   -> Result<ChatResponse, AcpError>` (the error split powers AC5's
   fallback-only-when-unavailable rule via `resolve_acp_result`).
2. `profile_for` returns defaults for claude/gemini/codex/goose, `None` for
   hermes/ollama/pi/aider/amp/antigravity, and honors
   `config.acp_launch_overrides["<agent>"]` (full command-line string) for
   ANY agent including ones without defaults.
3. `config.acp_enabled == false` routes everything legacy (verified by
   routing unit test, not by spawning).
4. End-to-end: `send` against the fixture fake agent returns a `ChatResponse`
   with agent name, ACP session id, and scripted text.
5. Fallback: ACP spawn failure for an agent with a legacy harness falls back
   and (in unit test, with a failing profile injected) reports the legacy
   path was taken.
6. `cargo test` green; existing harness behavior untouched when ACP disabled.

## Tasks

- [x] **Group A — failing tests first**
  - [x] `profile_for` mapping + override tests
  - [x] Routing decision tests (`acp_route(agent, &config) -> Route`)
  - [x] End-to-end `send` via fixture script
- [x] **Group B — implementation**
  - [x] Default profile table + override parsing (shell-words split)
  - [x] `send` building on STORY-0009 `prompt_via_acp`
  - [x] `send_prompt` routing + fallback in `harness.rs`
- [x] **Group C — verify**: `cargo test`, frontend suite unaffected

## Out of Scope

Streaming chunks to the UI; surfacing permission prompts in the UI
(see STORY-0011 downstream notes).
