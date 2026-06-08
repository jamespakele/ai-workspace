# BMADder Framework Orchestrator Context

## 1. Purpose

This document defines the framework-level rules, roles, state machine, and file
conventions for BMADder projects. It is project-agnostic: individual products
provide their own PRD and architecture but reuse this orchestration logic.

The orchestrator treats this file as the single source of truth for:
- Which agents exist and what they are allowed to do
- Which files constitute the shared "blackboard"
- Which state transitions are valid for stories
- Which gates must pass before code is written or accepted
- Which CLI agent handles each role

## 2. Agent Contract

All agents (PM, SM, PO, Developer, QA) MUST:
- Treat this file as the governing contract
- Obey the Story State Machine and gates
- Operate only on blackboard surfaces (PRD, Architecture, Epics, Stories, Standards)
- NEVER bypass PO or QA gates
- NEVER touch stories outside their allowed state transitions

## 3. Blackboard Architecture

All agent communication happens via files in the repo. No hidden context.
All decisions must be traceable to files under version control.

Surfaces:
- docs/prd.md – product requirements and business goals
- docs/architecture.md – system design and technical constraints
- docs/backlog/epics/ – epics as markdown files
- docs/backlog/stories/ – stories with YAML frontmatter
- docs/standards/ – coding, QA, and process standards
- _bmad/ – orchestrator context, logs, framework metadata
- _bmad/progress.txt – append-only log of dev progress across iterations
- _bmad/logs/activity.log – structured activity log

## 4. Roles

### Orchestrator (bmadder.sh)
- Bash script. Manages workflow, enforces state machine.
- Reads frontmatter, decides which agent to invoke next.
- Never writes code. Never makes judgment calls.

### Scrum Master → claude (sonnet)
- Shards PRD + architecture into epics and stories.
- Creates story files starting in status: "DRAFT".
- Sets agent_hint per story for dev routing.

### Product Owner → claude (sonnet)
- Alignment gate between planning and development.
- Reviews ALL draft stories at once for cross-story consistency.
- Moves stories to READY_FOR_DEV only when aligned.

### Developer → codex (backend) / gemini (UI) / claude (logic)
- Implements stories into code under src/.
- Runs feedback loops (build, test, lint) before marking done.
- Moves stories to PENDING_QA when implementation passes.
- Routed per-story via agent_hint in frontmatter.

### QA Auditor → claude (opus)
- Final gate before COMPLETED.
- Reviews code against acceptance criteria with deep reasoning.
- Moves stories to COMPLETED or REFIX.

## 5. Agent Routing

The orchestrator routes each invocation to the best agent:

| Phase        | Default Agent | Model    | Rationale                        |
|-------------|---------------|----------|----------------------------------|
| Plan (SM)   | claude        | sonnet   | Structured reasoning, doc gen    |
| Plan (PO)   | claude        | sonnet   | Checklist verification           |
| Dev (backend)| codex        | -        | Long-horizon coding              |
| Dev (UI/UX) | gemini        | stitch   | Frontend generation, multimodal  |
| Dev (logic) | claude        | sonnet   | Complex transforms, config       |
| QA          | claude        | opus     | Deep code review, nuanced audit  |

Stories carry an `agent_hint` field in frontmatter:
- agent_hint: "codex"  → backend, API, database, infrastructure
- agent_hint: "gemini" → UI/UX, frontend, visual design
- agent_hint: "claude" → complex logic, data transforms, config

## 6. Story Specification

Stories live in docs/backlog/stories/ as markdown with YAML frontmatter.

Filename: story-NNNN-slug.md (NNNN encodes priority/dependency order).

Frontmatter:

```yaml
---
story_id: "STORY-0012"
epic_id: "EPIC-0003"
title: "Implement some feature"
status: "DRAFT"            # DRAFT | REVISE | READY_FOR_DEV | IN_DEV | PENDING_QA | REFIX | COMPLETED
priority: "MUST_HAVE"
agent_hint: "codex"        # codex | gemini | claude (routes dev agent)
assigned_dev: null
po_alignment: "PENDING"    # PENDING | APPROVED | REVISE
qa_status: "NOT_STARTED"   # NOT_STARTED | PASS | FAIL
created_at: "YYYY-MM-DD"
updated_at: "YYYY-MM-DD"
links: []
---
```

Required body sections:

## Context
## Requirements
## Acceptance Criteria
## Implementation Notes
## PO Alignment
## QA Notes

## 7. State Machine

```
DRAFT ──→ REVISE ──→ DRAFT        (SM/PO revision loop)
DRAFT ──→ READY_FOR_DEV           (PO approves)
READY_FOR_DEV ──→ IN_DEV          (Orchestrator assigns to dev)
IN_DEV ──→ PENDING_QA             (Dev completes, tests pass)
PENDING_QA ──→ COMPLETED          (QA passes)
PENDING_QA ──→ REFIX              (QA fails)
REFIX ──→ IN_DEV                  (Back to dev for fixes)
```

Transition rules:
- Only PO may move DRAFT → READY_FOR_DEV (requires po_alignment: "APPROVED")
- Only Dev may move IN_DEV → PENDING_QA
- Only QA may move PENDING_QA → COMPLETED or REFIX
- The orchestrator (bash) enforces READY_FOR_DEV → IN_DEV and REFIX → IN_DEV
- QA PASS requires git commit + push before any further work

## 8. Fresh Context Rule

Each agent invocation starts with a clean context window. No conversation
state carries between invocations. Agents discover prior work by reading:
- _bmad/progress.txt (what was done in previous iterations)
- git log (commit history)
- Story frontmatter (current status)
- Implementation Notes section (what the dev did)

This is intentional. Clean context prevents hallucination drift and makes
every invocation independently reproducible.

## 9. Logging

All agents SHOULD log to _bmad/logs/activity.log:
YYYY-MM-DDTHH:MM:SSZ | ROLE | STORY_ID(or '-') | ACTION | description

Dev agents MUST append to _bmad/progress.txt after each iteration:
- What was done, files changed, decisions made, notes for next iteration
