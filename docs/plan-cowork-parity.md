# Plan: Cowork Parity — Gap Closure Tasks

Companion to `docs/gap-analysis-cowork.md`. Each task lists its scope, the
tests that prove the gap is closed, and done criteria. Tasks are ordered so
each builds on the previous.

Gateway protocol additions used below follow the existing event/RPC
conventions (`message.delta`, `tool.start`, `prompt.submit`, …): new events
`permission.request`, `plan.update`; new methods `permission.respond`,
`prompt.cancel`, `session.compact`.

## G0 — Test infrastructure (prerequisite)

- [x] Frontend: Vitest + @testing-library/react + jsdom; `npm test` script;
      shared setup (jest-dom matchers, `scrollIntoView` stub, Tauri `invoke`
      mock helper, fake WebSocket).
- [x] Rust: new `hermes-core` crate (no Tauri dependency, so it compiles and
      tests headlessly) holding pure logic for later tasks;
      `cargo test` green. `src-tauri` consumes it as a path dependency.
- Done: `npm test` and `cargo test -p hermes-core` run green; `npm run build`
  still green.

## G1 — Permission modes & approval flow

- [x] `ModeSelector` component: "Ask before acting" / "Auto" persisted in app
      state, included in `prompt.submit` params (`mode: "ask" | "auto"`).
- [x] `ApprovalCard` component for `permission.request` events: shows tool
      name + args; Allow once / Allow for session / Deny send
      `permission.respond` with `{request_id, decision}`.
- [x] "Allow for session" suppresses future prompts for that tool locally.
- Tests: mode included in submit params; approval card renders args; each
  button sends correct RPC; session-allow auto-responds to repeat requests.

## G2 — Stop & steer mid-task

- [x] Stop button in composer while streaming → `prompt.cancel`.
- [x] Composer remains enabled during streaming; sending text mid-stream
      issues `prompt.steer` correction with the active session id.
- Tests: stop sends cancel; mid-stream send issues steer (not submit) and
  appends the user message.

## G3 — Plan / progress panel

- [x] Handle `plan.update` events: `{steps: [{id, title, status}]}` with
      status `pending|running|done|error`.
- [x] `PlanPanel` renders steps with status icons; collapses when all done.
- Tests: event updates state; statuses render; replaces previous plan.

## G4 — Slash command menu

- [x] `src/lib/slash-commands.js`: built-ins (`/compact`, `/schedule`) +
      imported skills (via new `list_skills` Tauri command); prefix filtering.
- [x] Composer shows menu when input starts with `/`; selection completes the
      input; `/compact` sends `session.compact`.
- Tests: filter logic; menu opens on `/`; `/compact` path sends RPC.

## G5 — Scheduled tasks

- [x] `src/lib/cadence.js`: cadence model (`hourly`, `daily@HH:MM`,
      `weekly:<day>@HH:MM`, `every:<N>m`), `computeNextRun(task, now)`,
      `isDue(task, now)`.
- [x] Rust `scheduled.rs` commands `list_scheduled_tasks`,
      `save_scheduled_tasks` persisting `~/.hermes/scheduled_tasks.json`;
      serialization logic in `hermes-core::schedule` with unit tests.
- [x] `useScheduledTasks` hook: CRUD + 30s due-checker that submits the task
      prompt to the gateway and records `last_run`.
- [x] Sidebar "Scheduled" section: list with next-run display, create form
      (name, prompt, cadence), enable/disable, delete.
- Tests: cadence math (incl. day rollover, weekly wrap); store round-trip
  (Rust); due tasks fire exactly once per period (JS, fake timers); UI list +
  create.

## G6 — File preview pane

- [x] Rust `read_file` command: 512 KB cap, binary detection, returns
      `{content, truncated, binary}`; guards in `hermes-core::preview` with
      tests.
- [x] `PreviewPane` component: code with syntax highlight by extension,
      markdown rendered, images via convertFileSrc, binary/oversize notices.
- [x] File tree click (non-dir) opens preview; close button.
- Tests: guards (Rust); pane renders text/markdown/binary notice; tree click
  opens pane.

## G7 — Outputs panel

- [x] `src/lib/outputs.js`: `extractOutputPath(toolCall)` recognizing
      file-writing tools (`write_file`, `create_file`, `edit_file`, `save_*`)
      and their `path`/`file_path` args; dedupe set per session.
- [x] Outputs section in sidebar: files produced this session; click previews
      (G6); clears on session switch.
- Tests: extraction across tool shapes; dedupe; list renders; session switch
  clears.

## G8 — Context usage indicator

- [x] `src/lib/context-usage.js`: `computeContextUsage(tokens, limit)` →
      `{percent, level: ok|warn|critical}` (warn ≥70%, critical ≥90%);
      limit from config `context_window` (default 200k).
- [x] Status bar shows `ctx NN%` colored by level; `/compact` resets via
      `session.compact` + token reset.
- Tests: thresholds, zero/over-limit clamping; status bar renders level.

## G9 — Connectors (MCP) management

- [x] Rust `mcp.rs` commands `list_mcp_servers`, `save_mcp_servers` for
      `~/.hermes/mcp.json`; add/remove/validate logic in `hermes-core::mcp`
      with tests.
- [x] Settings "Connectors" section: list servers (name, transport,
      command/url), add form, remove, enable/disable toggle; restart-gateway
      notice after changes.
- Tests: JSON edit logic (Rust); section renders list; add/remove flows
  invoke commands.

## G10 — Session search

- [x] Search input in session switcher filtering by title/preview
      (case-insensitive); empty-result state.
- Tests: filter narrows list; clearing restores; no-match message.

## Loop protocol

For each task: write tests first where practical → implement → run
`npm test` (and `cargo test -p hermes-core` for Rust changes) → fix until
green → `npm run build` must stay green → check the box here → commit.
All boxes checked + full suite green = plan complete.
