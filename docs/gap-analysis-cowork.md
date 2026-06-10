# Gap Analysis: Hermes Desktop vs. Claude Cowork

Date: 2026-06-10
Inputs: Anthropic product page, Claude Help Center articles (Get started with Claude
Cowork, Scheduled tasks, Use Cowork safely, Live artifacts, Dispatch), Claude Code
Desktop documentation, third-party tutorials (DataCamp, Jeff Su, KDnuggets).

## 1. Claude Cowork feature set (reference)

Claude Cowork is the agentic knowledge-work surface of the Claude Desktop app
(Chat / Cowork / Code tabs). Its observable feature set:

| # | Feature | Description |
|---|---------|-------------|
| C1 | Folder-scoped file access | "Work in a folder": Claude reads/edits/creates files only inside folders the user grants. Deletion requires explicit approval. |
| C2 | Plan-first approval flow | Claude shows its plan and waits for approval; mode selector ("Ask before acting" vs. autonomous); user can approve/deny individual actions. |
| C3 | Steering & interruption | Stop button; type a correction mid-task and Claude adjusts without restarting. |
| C4 | Progress indicators | Per-step plan/progress display while Claude works; watch, intervene, or walk away. |
| C5 | Parallel work | Multiple concurrent sessions; sub-agents fan out within a task. |
| C6 | Connectors (MCP) | Catalog + management UI for Gmail, Drive, Slack, Calendar, etc. |
| C7 | Skills & plugins | `/` slash-command menu; skills load automatically or by invocation; plugins bundle skills + connectors + agents. |
| C8 | Scheduled tasks | `/schedule` command and a "Scheduled" sidebar section; recurring cadence; runs with full connector/skill access. |
| C9 | Dispatch | Persistent conversation that accepts tasks from anywhere (incl. phone) and routes them. |
| C10 | Live artifacts | Persistent interactive HTML dashboards in a "Live artifacts" tab, refreshable with live connector data. |
| C11 | File viewer / preview pane | Click a path in chat to open it; HTML/PDF/image/video preview; diff viewer. |
| C12 | Context management | Usage indicator, automatic compaction, `/compact` command. |
| C13 | Session history & projects | Recents sidebar, search/filter, projects with memory. |
| C14 | Sandboxed execution | Shell/code runs in an isolated VM; outputs delivered to the file system. |
| C15 | Computer use | Controlled app/screen automation (research preview). |

## 2. Current Hermes Desktop coverage

Implemented (Phase 1, stories 0001–0007): chat with streaming + markdown +
tool-call cards, session switcher backed by `~/.hermes/state.db`, project
switcher + lazy file tree, gateway lifecycle with reconnect/backoff, status bar
(connection, model, session, raw token count), settings panel, `.skill` zip
importer. No test infrastructure exists.

## 3. Gap matrix

| Gap | Cowork feature | Hermes Desktop today | Disposition |
|-----|----------------|----------------------|-------------|
| G1 | C2 Approval flow & permission modes | None; gateway acts autonomously, no approval UI | **Close**: mode selector (Ask / Auto) + approval cards for `permission.request` gateway events |
| G2 | C3 Steering & interruption | Composer disabled while streaming; no stop | **Close**: Stop button (`prompt.cancel`), composer stays enabled to send mid-task corrections |
| G3 | C4 Progress indicators | Only raw tool cards | **Close**: plan panel rendering `plan.update` events (steps + statuses) |
| G4 | C7 Skills invocation | Skills importable but not invocable from UI | **Close**: `/` slash menu in composer (imported skills + built-ins `/compact`, `/schedule`) |
| G5 | C8 Scheduled tasks | None | **Close**: Scheduled sidebar section; CRUD persisted by Rust backend; cadence engine computes next runs; due tasks submitted to gateway |
| G6 | C11 File viewer / preview | File tree only; files cannot be opened | **Close**: preview pane (text/code/markdown/images) via new `read_file` command with size/binary guards |
| G7 | C14 Outputs surfaced | Tool results truncated in cards; created files not surfaced | **Close**: Outputs panel tracking files written by tools during the session, click-to-preview |
| G8 | C12 Context management | Raw token count only | **Close**: context-usage percentage with warn/critical states + `/compact` |
| G9 | C6 Connectors management | None | **Close**: MCP server management UI in Settings, persisted to `~/.hermes/mcp.json` |
| G10 | C13 Session search | Flat list of 50 recents | **Close**: search/filter input in session switcher |
| G11 | C1 Folder scoping | Project selection exists; enforcement lives in Hermes Agent backend | Partial by design (thin shell); surfaced via project switcher |
| G12 | C5 Sub-agents / parallel sessions | Single session at a time | **Defer**: requires gateway multi-session protocol work (backend) |
| G13 | C9 Dispatch | None | **Out of scope**: requires Anthropic cloud/mobile infrastructure |
| G14 | C10 Live artifacts | None | **Out of scope** for this pass: HTML preview lands via G6; live MCP-refresh dashboards need backend support |
| G15 | C14 VM sandbox | Execution isolation is the Hermes Agent backend's responsibility | Out of scope for the UI shell |
| G16 | C15 Computer use | None | Out of scope (platform capability, not UI) |

G12–G16 are documented as deferred/out-of-scope: they require backend or
platform capabilities that do not live in this repository (the PRD's "thin
shell, thick engine" principle). G1–G10 are closable in this codebase and are
planned in `docs/plan-cowork-parity.md`.

## 4. Cross-cutting gap: testing

Cowork parity claims are unverifiable today: the repo has **no test framework**
(no Vitest/Jest/RTL, no Rust unit tests, no CI). Test infrastructure is a
prerequisite task (G0) so every gap closure lands with tests as its done
criteria.
