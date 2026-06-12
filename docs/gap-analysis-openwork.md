# Gap Analysis: OpenWork as a Starting Point

Date: 2026-06-12
Subject: [different-ai/openwork](https://github.com/different-ai/openwork) (MIT,
~16k stars, Tauri + React/TS, OpenCode engine) evaluated as an alternative base
to `hermes-desktop` for the desired feature set: Claude Cowork parity on Linux
plus our local modifications (instance discovery/connect wizard, scheduled
tasks, Hermes backend).

Method: source inspection of a fresh clone (v0.16.x, `apps/app`, `apps/server`,
`ee/`), GitHub project page, plus the Cowork feature reference (C1–C15) from
`docs/gap-analysis-cowork.md`.

## 1. What OpenWork is

Desktop app (macOS/Linux free; Windows builds paid) wrapping the OpenCode
agent engine over HTTP REST + SSE. Pluggable backend: spawns a local server
(host mode) or connects to any OpenCode-compatible URL + bearer token (client
mode), with invite-link hydration (`ow_url`/`ow_token`). Models are delegated
to OpenCode's provider system — any OpenAI-compatible endpoint works, so
NousResearch Hermes models run via Ollama/OpenRouter/custom endpoint in
`opencode.json`.

## 2. OpenWork vs. Cowork feature set (C1–C15)

| Cowork feature | OpenWork core (MIT) | Evidence |
|---|---|---|
| C1 Folder-scoped access | ✅ Authorized-folders list + workspace file APIs | `apps/server/src/authorized-folders.e2e.test.ts` |
| C2 Plan-first approvals | ✅ Approval service, `auto`/manual modes, timeouts, pending queue | `apps/server/src/approvals.ts` |
| C3 Steering & stop | ◐ Abort (`abortSessionSafe`) yes; mid-task steering UI not evident | `apps/app/src/app/lib/opencode-session.ts` |
| C4 Progress indicators | ✅ Todo/timeline rendering of task execution | session domain components |
| C5 Parallel sessions | ◐ Multiple sessions per workspace; no side-by-side/worktree isolation | session domain |
| C6 Connectors (MCP) | ✅ Per-workspace add/remove/enable, OAuth flows, remote connect | `apps/server/src/mcp.ts` + e2e tests |
| C7 Skills & plugins | ✅✅ Skills manager + hub; installs **Claude Code plugin bundles** (skills/commands/agents/.mcp.json) | `apps/server/src/claude-plugin-bundle.ts`, `cloud-plugins.ts` |
| C8 Scheduled tasks | ❌ in core — recurring flows exist only in paid `ee/` (den-flow) | `ee/apps/den-web/.../den-flow.ts` |
| C9 Dispatch / remote assign | ◐ Cloud workers via paid Den control plane; no free mobile path | `ee/apps/den-api` |
| C10 Live artifacts | ✅ Artifact panel system: spreadsheets, markdown, HTML, PDF, images, browser | `apps/app/src/components/chat/artifact.tsx` |
| C11 File viewer/preview | ✅ Workspace file ops + artifact rendering | server file routes |
| C12 Context management | ✅ `compactSession` via `session.summarize` / `/compact` | `opencode-session.ts:113-142` |
| C13 Session history/search | ✅ CRUD, history, search | session domain |
| C14 Sandboxed execution | ✅ Microsandbox image, local-first | `packaging/` |
| C15 Computer use | ❌ | — |

Coverage is substantially deeper than `hermes-desktop` Phase 1+2 on C1, C6,
C7, C10, C11, C14 — with a real test culture (57+ test files, extensive e2e).

## 3. OpenWork vs. our desired modifications

| Desired modification | OpenWork status | Gap to close if we start there |
|---|---|---|
| **Connect wizard / instance discovery** (scan local installs + Docker instances, dropdown picker) | ❌ Manual URL + token entry only; dormant `lanUrl`/`mdnsUrl` fields, no discovery UI (`apps/app/src/app/lib/openwork-server.ts`) | Port our discovery concept: scan PATH/conventional dirs for `opencode`/`openwork-orchestrator`, `docker ps` parsing, port probes, picker UI. Our `hermes-core::discovery` parsing logic and wizard UX transfer directly (TS rewrite of ~150 LoC Rust + reuse of `connect-wizard.jsx` patterns). |
| **Scheduled tasks** (cadence, sidebar section) | ❌ in MIT core (ee-gated) | Port our `cadence.js` (drops in as-is, tested) + scheduler hook + panel against OpenWork's session API. Strong upstream-PR candidate. |
| **Hermes backend** | ◐ Hermes **models**: trivial (`opencode.json` provider entry). Hermes **Agent gateway** (TUI JSON-RPC, `~/.hermes/state.db`, `.hermes/skills`): not supported; OpenCode replaces that engine | Accept OpenCode as engine (recommended), or write an OpenCode-compatible adapter in front of the Hermes gateway (significant; protocol shim with sessions/SSE/approvals). |
| Permission modes, plan panel, stop, /compact, MCP UI, session search | ✅ already present | Nothing — discard our implementations. |
| Outputs panel | ✅ exceeded by artifact panels | Nothing. |

## 4. What transfers from this repo if we pivot

- `docs/gap-analysis-cowork.md` framing (C1–C15) — still the requirements map.
- `src/lib/cadence.js` + tests — engine-agnostic, drops into a TS codebase.
- `hermes-core::discovery` parsing rules + `connect-wizard.jsx` UX — concept
  and tests port to TS.
- Discarded: chat/composer/preview/statusbar/MCP-settings implementations
  (OpenWork's equivalents are deeper), Tauri command layer, gateway hook.

## 5. Risks / trade-offs of pivoting

1. **Engine swap**: OpenCode replaces Hermes Agent as the agent runtime. If
   the Hermes Agent toolchain itself (not just its models) is a hard
   requirement, OpenWork doesn't satisfy it without an adapter.
2. **Codebase scale**: monorepo (pnpm + turbo, `apps/`, `packages/`, `ee/`)
   is a much larger surface than our ~3k-line shell; slower to learn, faster
   to ship features once learned.
3. **Open-core boundary**: Windows builds, cloud workers, org features, and
   recurring flows are paid. Risk that future features land ee-side —
   mitigated by MIT license (fork keeps everything current-core).
4. **Upstream drift**: a fork carrying local mods needs a rebase routine;
   contributing the discovery wizard and scheduled tasks upstream reduces
   carry weight.

## 6. Recommendation

If the goal is "Cowork alternative on Linux with my modifications," start
from OpenWork: parity coverage, tests, packaging, and community outpace what
a from-scratch shell can sustain. Concretely:

1. Fork/clone openwork; verify Hermes models via an `opencode.json` provider
   entry (Ollama or OpenRouter).
2. Port G11 connect wizard (discovery of local installs + Docker instances →
   picker) against their connection layer.
3. Port G5 scheduled tasks (cadence engine + panel) into core; offer both
   upstream as PRs.
4. Keep `hermes-desktop` parked (PR #1 left open) as the direct
   Hermes-gateway UI in case the Hermes Agent engine remains a requirement.
