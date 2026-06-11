---
story_id: "STORY-0011"
title: "ACP Downstream Adoption (config, settings UI, docs, follow-ups)"
status: "COMPLETED"
created_at: "2026-06-11"
updated_at: "2026-06-11"
epic: "ACP adoption (replaces stdout-scraping harnesses)"
---

# Story 11: Downstream Adoption of ACP

## Story

As a user and as future contributors,
I want the configuration surface, settings UI, and architecture docs to
reflect that ACP is the primary harness path,
so that downstream code adopts the ACP methods going forward instead of
growing new flag-based integrations.

## Downstream audit (what must change now)

| Surface | Change | Status |
|---|---|---|
| `config.rs` | `acp_enabled: bool` (default true), `acp_auto_approve: bool` (default false), `acp_launch_overrides: HashMap<String,String>` — all `#[serde(default)]`, so existing config.json files load unchanged | this story |
| `harness.rs::send_prompt` | routes through ACP first (STORY-0010) | done in 0010 |
| `settings.jsx` | "Agents" section: ACP enable toggle + auto-approve toggle, persisted via existing `save_config` | this story |
| `src-tauri/main.rs`, `src-server/main.rs` | none — SessionManager is global inside workspace-core | n/a |
| `api.js` COMMAND_MAP | none — config travels through existing get/save_config | n/a |
| `docs/architecture.md` | new "ACP harness" section: routing rule, profiles, fallback | this story |

## Downstream follow-ups unlocked (NOT in this story)

- **Streaming UI**: `session/update` chunks can stream to the composer; the
  current assembled-response `ChatResponse` keeps parity until the UI grows
  a streaming channel (Tauri events / SSE in src-server).
- **Permission approvals in UI**: `session/request_permission` can drive the
  existing `approval-card.jsx` component (its gateway-era tests were retired;
  the component is the natural ACP client surface). Until then the policy is
  config-level (`acp_auto_approve`).
- **Plan panel revival**: ACP `plan` updates map onto `plan-panel.jsx`.
- **Legacy harness retirement**: once ACP profiles are verified per machine
  for claude/gemini/codex/goose, their flag-based `send()` paths become
  fallback-only and can eventually be deleted.

## Acceptance Criteria

1. Config round-trips new fields; old config.json without them still loads
   (serde-default test).
2. Settings panel shows and persists the two ACP toggles (vitest).
3. `docs/architecture.md` documents the ACP harness path.
4. Full suites green: `cargo test`, `npx vitest run`, `npx vite build`,
   `cargo check` in src-server.

## Tasks

- [x] **Group A — failing tests first**: config serde defaults test; settings
      panel toggle test
- [x] **Group B — implementation**: config fields; settings UI; architecture
      doc section
- [x] **Group C — verify**: all suites green, push
