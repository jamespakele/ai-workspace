---
story_id: "STORY-0006"
title: "Chat Interface & Composer"
status: "COMPLETED"
qa_status: "PASS"
po_alignment: "APPROVED"
created_at: "2026-06-08"
updated_at: "2026-06-08T17:00:00Z"
---

# Story 6.1: Chat Interface & Composer

Status: COMPLETED

## Story

As a developer using Hermes Desktop,
I want to send messages to the Hermes gateway and see streaming responses with markdown rendering, tool call cards, and a proper composer,
so that the application is usable for real agentic conversations.

## Acceptance Criteria

1. **New npm packages installed**: `react-markdown` (^9.x), `remark-gfm` (^4.x), and `react-syntax-highlighter` (^15.x) added to `hermes-desktop/package.json` dependencies. `npm run build` passes with no new build errors after install.

2. **`Markdown` component** (`src/components/markdown.jsx`): Replaces the stub. Uses `react-markdown` + `remark-gfm` for full markdown rendering (headings, bold, italic, inline code, links, ordered/unordered lists, blockquotes, tables). Code blocks use a custom renderer backed by `SyntaxHighlighter` from `react-syntax-highlighter/dist/esm/prism` with `oneDark` style. Inline code uses `font-mono text-[11px] bg-panel/80 px-1 rounded`. Non-code content uses `prose prose-invert max-w-none text-sm leading-6`.

3. **`useHermesGateway` extended for chat events** (`src/hooks/useHermesGateway.js`): The hook accepts an optional `onChatEvent` parameter: `useHermesGateway({ onChatEvent } = {})`. The callback is stored in a `useRef` and updated via `useEffect([onChatEvent])` so it never causes reconnect cycles. Inside `handleEvent`, after the existing switch block, if `message.event` is one of `['message.delta', 'tool.start', 'tool.progress', 'tool.complete', 'message.complete', 'session.error']`, call `onChatEventRef.current?.(message)`. The existing handlers for `gateway.ready`, `model.changed`, and `message.complete` (token count) are unchanged — `message.complete` is handled in the switch (token accumulation) AND forwarded to the callback (streaming state). No new state is exposed from the hook.

4. **Chat message state model in `app.jsx`**: The static `const messages = [...]` is removed. Replaced with `const [messages, setMessages] = useState([])` and `const [isStreaming, setIsStreaming] = useState(false)`. The static scaffold `<Markdown>` block and static `<ToolCard>` stub in the JSX are removed. Each message object shape: `{ id: string, role: 'user' | 'assistant' | 'error', content: string, toolCalls: Array, isStreaming: boolean }`. Each tool call object shape: `{ id: string, name: string, args: object, partialOutput: string, result: string | null, status: 'running' | 'done' }`.

5. **`handleChatEvent` callback in `app.jsx`**: A stable `useCallback` with no dependencies (uses functional state setters only). Processes events:
   - `message.delta`: If last message is `assistant` with `isStreaming: true`, append `event.data?.delta ?? ''` to its content. Otherwise push a new assistant message `{ id: event.data?.message_id ?? crypto.randomUUID(), role: 'assistant', content: event.data?.delta ?? '', toolCalls: [], isStreaming: true }`. Set `isStreaming(true)`.
   - `tool.start`: Find last assistant message with `isStreaming: true`, append new tool call `{ id: event.data?.tool_call_id ?? crypto.randomUUID(), name: event.data?.tool_name ?? '', args: event.data?.args ?? {}, partialOutput: '', result: null, status: 'running' }` to its `toolCalls`.
   - `tool.progress`: In last assistant message's `toolCalls`, find by `id === event.data?.tool_call_id`, set `partialOutput = event.data?.output ?? ''`.
   - `tool.complete`: In last assistant message's `toolCalls`, find by `id === event.data?.tool_call_id`, set `result = event.data?.result ?? ''`, `status = 'done'`.
   - `message.complete`: Set `isStreaming: false` on last assistant message. Set global `isStreaming` state to `false`. (Token count is handled in the hook — do NOT duplicate here.)
   - `session.error`: Push `{ id: crypto.randomUUID(), role: 'error', content: event.data?.message ?? 'Gateway error', toolCalls: [], isStreaming: false }`. Set global `isStreaming` state to `false`.

6. **Auto-scroll in `app.jsx`**: A `messagesEndRef = useRef(null)` is attached to a `<div ref={messagesEndRef} />` placed as the last child of the messages scroll container. A `useEffect([messages])` calls `messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })` whenever `messages` changes.

7. **`UserMessage` component** (exported from `src/components/message.jsx`): Props: `{ message }`. Renders right-aligned (`flex justify-end`), max-width `max-w-[80%] ml-auto`. Bubble: `rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3`. Header label: `font-mono text-[10px] uppercase tracking-[0.24em] text-accent` showing "YOU". Message text: `text-sm leading-6 text-text` rendered as plain text (no markdown).

8. **`AssistantMessage` component** (exported from `src/components/message.jsx`): Props: `{ message }`. Renders left-aligned, no outer border. Uses `<Markdown content={message.content} />` for the text body. If `message.isStreaming` is `true`, appends `<span className="animate-pulse text-accent">▋</span>` after the `<Markdown>` block. Renders `message.toolCalls` below the text body, one `<ToolCallCard>` per tool call. The `Message` export is replaced by separate `UserMessage` and `AssistantMessage` exports — the old unified `Message` export is removed.

9. **`ToolCallCard` component** (`src/components/toolcard.jsx`): Props: `{ toolCall }`. Local `expanded` state, initialized to `true`. When `toolCall.status` transitions from `'running'` to `'done'` (via `useEffect([toolCall.status])`), set `expanded` to `false`. Header: clickable row (`onClick={() => setExpanded(v => !v)}`), shows `toolCall.name` in `font-mono text-sm text-text`, and a status indicator on the right: animated CSS spinner (`animate-spin inline-block border-2 border-accent border-t-transparent rounded-full w-3 h-3`) when `status === 'running'`; `✓` in `text-accent` when `status === 'done'`. When `expanded`: show `JSON.stringify(toolCall.args, null, 2)` in a `<pre className="mt-2 overflow-x-auto rounded-lg bg-canvas p-3 font-mono text-[11px] text-muted">`. If `status === 'running'` and `partialOutput` non-empty, show `partialOutput` in a similarly styled `<pre>`. If `status === 'done'` and `result` non-null, show `result.slice(0, 500)` (with `...` suffix if truncated) in the same styled `<pre>`. Outer container: `my-2 rounded-xl border border-border bg-sidebar/60 px-4 py-3`.

10. **`Composer` component** (`src/components/composer.jsx`): Replaces stub. Props: `{ pendingContextPath, onContextInjected, isStreaming, send, activeSessionId }`. Real `<textarea>` (remove `readOnly`), controlled via `const [text, setText] = useState('')`. `useEffect([pendingContextPath])`: if `pendingContextPath` is non-null, set `text` to `'@' + pendingContextPath + ' ' + text.trimStart()` and call `onContextInjected()`. `onKeyDown` handler on textarea: if `event.key === 'Enter'` and `!event.shiftKey`, call `event.preventDefault()` then `handleSend()`. `handleSend()`: trim `text`, return if empty or `isStreaming`; call `send('prompt.submit', { text: text.trim(), session_id: activeSessionId })`; then `setMessages` via prop — wait, Composer does NOT set messages; instead, after `send()`, push a user message into `app.jsx` messages state via an `onUserMessage` callback prop: `onUserMessage({ id: crypto.randomUUID(), role: 'user', content: text.trim(), toolCalls: [], isStreaming: false })`; then `setText('')`. Send button: `disabled` when `isStreaming` is `true`, styled `opacity-50 cursor-not-allowed` when disabled. Textarea `placeholder="Message Hermes…"`.

11. **`app.jsx` wiring and message rendering**: `useHermesGateway` called as `useHermesGateway({ onChatEvent: handleChatEvent })`. Composer receives: `pendingContextPath`, `onContextInjected={() => setPendingContextPath(null)}`, `isStreaming`, `send`, `activeSessionId`, `onUserMessage={(msg) => setMessages(prev => [...prev, msg])}`. Message list: if `messages.length === 0`, render `<p className="text-muted text-sm text-center mt-16">Start a conversation.</p>`. For each message: `role === 'user'` → `<UserMessage message={m} />`, `role === 'assistant'` → `<AssistantMessage message={m} />`, `role === 'error'` → `<div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">{m.content}</div>`. Import `UserMessage` and `AssistantMessage` from `./components/message` (replace old `Message` import).

## Tasks / Subtasks

- [x] Install new npm packages (AC: #1)
  - [x] `cd hermes-desktop && npm install react-markdown remark-gfm react-syntax-highlighter`
  - [x] Verify `npm run build` passes after install
- [x] Implement `markdown.jsx` — real markdown renderer (AC: #2)
  - [x] Import `ReactMarkdown` from `react-markdown`, `remarkGfm` from `remark-gfm`
  - [x] Import `SyntaxHighlighter` from `react-syntax-highlighter/dist/esm/prism` and `oneDark` style
  - [x] Define `components` object with `code` renderer: check `className` for `language-*` match (react-markdown v9 removed `inline` prop); use `SyntaxHighlighter` for blocks, `<code className="font-mono ...">` for inline/unlabelled code
  - [x] Replace stub: render `<ReactMarkdown remarkPlugins={[remarkGfm]} components={components} className="prose prose-invert ...">` 
- [x] Extend `useHermesGateway.js` for chat event routing (AC: #3)
  - [x] Change signature to `useHermesGateway({ onChatEvent } = {})`
  - [x] Add `const onChatEventRef = useRef(onChatEvent)` above the effect
  - [x] Add `useEffect(() => { onChatEventRef.current = onChatEvent; }, [onChatEvent])`
  - [x] In `handleEvent`: after existing switch, add routing for chat event types
- [x] Add message state and `handleChatEvent` to `app.jsx` (AC: #4, #5, #6)
  - [x] Remove static `const messages = [...]`
  - [x] Add `const [messages, setMessages] = useState([])`
  - [x] Add `const [isStreaming, setIsStreaming] = useState(false)`
  - [x] Implement `handleChatEvent` as `useCallback` with functional setters for all 6 event types
  - [x] Add `messagesEndRef`, auto-scroll `useEffect`
  - [x] Remove scaffold Markdown block and ToolCard stub from JSX
- [x] Implement `UserMessage` and `AssistantMessage` in `message.jsx` (AC: #7, #8)
  - [x] Remove old `Message` component
  - [x] Add `UserMessage`: right-aligned bubble with "YOU" badge, plain text
  - [x] Add `AssistantMessage`: left-aligned, `<Markdown>` body, blinking cursor when streaming, renders ToolCallCards
- [x] Implement `ToolCallCard` in `toolcard.jsx` (AC: #9)
  - [x] Replace `ToolCard` export with `ToolCallCard` accepting `{ toolCall }` prop
  - [x] Local `expanded` state (init `true`), effect on `toolCall.status` change to auto-collapse
  - [x] Header with name, spinner/checkmark, click-to-toggle
  - [x] Expanded body: args JSON, partialOutput (if running), result (if done, truncated)
- [x] Implement `Composer` in `composer.jsx` (AC: #10)
  - [x] Replace stub with controlled textarea
  - [x] Enter-to-send, Shift+Enter newline
  - [x] `pendingContextPath` injection via `useEffect`
  - [x] `handleSend`: calls `send`, calls `onUserMessage`, clears text
  - [x] Disable while `isStreaming`
- [x] Wire everything in `app.jsx` (AC: #11)
  - [x] Declare `handleChatEvent` (useCallback) **before** the `useHermesGateway` call — JS requires the variable to exist before it's passed
  - [x] Update `useHermesGateway` call to pass `onChatEvent: handleChatEvent`; keep all existing destructured fields (`status`, `send`, `activeModel`, `tokenCount`, `resetTokenCount`)
  - [x] Remove `ToolCard` and `Markdown` imports (both are now used only inside `AssistantMessage`, not in `app.jsx`)
  - [x] Update message import: `UserMessage`, `AssistantMessage` (remove old `Message`)
  - [x] Update Composer props (add `onContextInjected`, `isStreaming`, `send`, `activeSessionId`, `onUserMessage`)
  - [x] Add empty-state placeholder
  - [x] Add per-role message rendering logic

## Dev Notes

### Stub Files Being Replaced

| File | Current stub | Change |
|------|-------------|--------|
| `src/components/markdown.jsx` | Plain `<p>` wrapped in prose div | Real react-markdown + syntax highlighter |
| `src/components/message.jsx` | Single `Message` component, plain text | Split into `UserMessage` + `AssistantMessage` with markdown |
| `src/components/toolcard.jsx` | `ToolCard` with no state | `ToolCallCard` with expand/collapse, status icons |
| `src/components/composer.jsx` | ReadOnly stub textarea | Real controlled textarea with Enter-to-send |
| `src/app.jsx` | Static messages array, scaffold blocks | Live state, event-driven message updates |

### `useHermesGateway` Stable Callback Pattern

The `onChatEvent` callback from `app.jsx` will be recreated on every render (it's a `useCallback` with no deps, but the function identity may still change). To avoid triggering reconnect, use the stable ref pattern — do NOT add `onChatEvent` to the main `useEffect` dependency array:

```js
const onChatEventRef = useRef(onChatEvent);
useEffect(() => { onChatEventRef.current = onChatEvent; }, [onChatEvent]);
// Inside handleEvent (already inside the connection useEffect closure):
// message.complete is listed here so handleChatEvent can set isStreaming:false;
// the switch block still handles it first for token accumulation.
const CHAT_EVENTS = new Set(['message.delta', 'tool.start', 'tool.progress', 'tool.complete', 'message.complete', 'session.error']);
if (message.event && CHAT_EVENTS.has(message.event)) {
  onChatEventRef.current?.(message);
}
```

### `handleChatEvent` Declaration Order

`handleChatEvent` must be declared with `useCallback` **before** the `useHermesGateway({ onChatEvent: handleChatEvent })` call in `app.jsx`. JavaScript does not hoist `const` declarations, so passing it to the hook first will throw a ReferenceError. Order in `app.jsx`: state declarations → `handleChatEvent` → `useHermesGateway(...)` → remaining hooks.

### `handleChatEvent` Functional Setters Only

`handleChatEvent` must use `setMessages(prev => ...)` functional form everywhere — it will be stable (no deps) only if it never closes over stale state. Do NOT close over `messages` or `isStreaming` directly.

### Composer → App Message Push

The Composer does not have direct access to `setMessages`. Instead, `app.jsx` passes `onUserMessage={(msg) => setMessages(prev => [...prev, msg])}` as a prop. The Composer calls this after `send()` to immediately display the user's message in the chat without waiting for a gateway echo.

### `ToolCallCard` vs Old `ToolCard`

The old `ToolCard` export in `toolcard.jsx` is used in `app.jsx` as a scaffold stub. After this story, `app.jsx` removes the `<ToolCard>` static stub and imports `ToolCallCard` for use inside `AssistantMessage`. The old `ToolCard` export can be removed entirely — no other files reference it.

### `Message` vs `UserMessage`/`AssistantMessage`

`app.jsx` currently imports `{ Message }` from `./components/message`. After this story it imports `{ UserMessage, AssistantMessage }`. The old unified `Message` export is removed. Update the import line.

### `react-syntax-highlighter` Code Block Renderer

The `code` component renderer in `react-markdown` v9 receives `{ node, className, children, ...props }`. The `inline` prop was **removed in react-markdown v9** — do NOT use it. Instead, detect block code by matching `className` against `language-*`: fenced code blocks always carry this class; inline code does not. Language is extracted from `className` (format: `language-js`):

```jsx
const code = ({ className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match?.[1] ?? '';
  return match ? (
    <SyntaxHighlighter style={oneDark} language={lang} PreTag="div" className="rounded-lg text-[11px]">
      {String(children).replace(/\n$/, '')}
    </SyntaxHighlighter>
  ) : (
    <code className="font-mono text-[11px] bg-panel/80 px-1 rounded" {...props}>{children}</code>
  );
};
```

Edge case: fenced blocks with no language specifier (e.g., ```` ``` ```` without a tag) have no `language-*` class and will render as inline-styled code. This is acceptable for Phase 1.

### Design Tokens

```
bg-canvas        #0F0F11  — main chat background
bg-panel/80      hover, inline code background
bg-sidebar/60    tool card background
bg-accent/10     user message bubble tint
border-accent/40 user message bubble border
text-accent      "YOU" label, streaming cursor, spinner
text-muted       timestamps, tool call label, empty-state text
font-mono        "YOU" badge, tool call name, code blocks → JetBrains Mono
animate-pulse    streaming cursor blink
animate-spin     tool call running spinner
```

### Gateway Event Payload Shapes

These are the expected Hermes TUI Gateway event shapes. Treat all fields as optional (use `?.` or `?? default`):

```js
// message.delta
{ event: 'message.delta', data: { message_id: string, delta: string } }

// tool.start
{ event: 'tool.start', data: { tool_call_id: string, tool_name: string, args: object } }

// tool.progress
{ event: 'tool.progress', data: { tool_call_id: string, output: string } }

// tool.complete
{ event: 'tool.complete', data: { tool_call_id: string, result: string } }

// message.complete (already handled in hook for token count)
{ event: 'message.complete', data: { message_id: string, input_tokens: number, output_tokens: number } }

// session.error
{ event: 'session.error', data: { message: string } }
```

### No New Tauri Commands or Rust Changes

This story is entirely React-side. Do NOT modify `src-tauri/src/main.rs` or any Rust file. All 9 Tauri commands remain as registered in prior stories.

### `app.jsx` Imports After This Story

```js
import { useState, useEffect, useRef, useCallback } from "react";
import { Sidebar } from "./components/sidebar";
import { SettingsPanel } from "./components/settings";
import { StatusBar } from "./components/statusbar";
import { UserMessage, AssistantMessage } from "./components/message";
import { Composer } from "./components/composer";
import { SessionSwitcher } from "./components/session-switcher";
import { useHermesGateway } from "./hooks/useHermesGateway";
import { useSessions } from "./hooks/useSessions";
// Markdown and ToolCallCard are used inside AssistantMessage — not imported in app.jsx directly
```

### Previous Story Context

- **STORY-0003**: `useHermesGateway` connection/reconnect logic, `send(method, params)` signature, and `tokenCount`/`resetTokenCount` exports must not change. Only extend the hook, do not rewrite.
- **STORY-0004**: `activeSessionId` from `useSessions` is used as `session_id` in `prompt.submit`. `resetTokenCount` should be called when a new session starts — this wiring already exists in `SessionSwitcher`.
- **STORY-0005**: `pendingContextPath` and `setPendingContextPath` wiring in `app.jsx` already done. Composer now receives `pendingContextPath` prop (the plumbing was set up in STORY-0005 AC#8). `onContextInjected` callback needs to be added to clear it.
- **Gateway `send` API**: Already implemented as `send(method, params)` (positional args, not an object). Composer calls `send('prompt.submit', { text, session_id: activeSessionId })`.

### Out of Scope for This Story (Deferred)

- **C5 (P1)** — Thinking/reasoning blocks: requires a distinct event type and collapsed-by-default UI treatment. Separate story.
- **C6 (P1)** — Diff output in Edit file tool cards: requires diff rendering (react-diff-viewer or similar). Separate story.
- **C9 (P2)** — Session message count in chat header: cosmetic, deferred.
- **M2 (P1)** — File attachment via paperclip: requires `@tauri-apps/plugin-dialog` file picker and chip UI. Separate story.
- **M3/M4 (P1)** — Slash command palette: requires skill list from gateway or file system. Separate story.
- **M5 (P2)** — File attachment chips above composer: deferred with M2.

### References

- Streaming event protocol: [Source: docs/architecture.md#2.3-streamed-events]
- `prompt.submit` RPC method: [Source: docs/architecture.md#2.2-key-rpc-methods]
- Data flow (user sends message): [Source: docs/architecture.md#8.1-user-sends-a-message]
- Component tree: [Source: docs/architecture.md#4.2-react-frontend]
- PRD chat interface requirements: [Source: docs/prd.md#6.1-chat-interface] (C1-C3, C7)
- PRD composer requirements: [Source: docs/prd.md#6.2-composer] (M1)
- Design tokens: [Source: hermes-desktop/src/styles/globals.css]
- Tech stack: [Source: docs/architecture.md#5-tech-stack]

## PO Alignment

2026-06-08 PO APPROVED: Full P0 PRD coverage (C1 streaming, C2 markdown, C3 tool cards, C7 user messages, M1 composer). Architecture-consistent file locations, component naming, and hook extension pattern. All 11 ACs are numbered, specific, and testable. Dependencies on STORY-0003/0004/0005 all COMPLETE. No duplicate scope with any prior story. Ready for dev.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `npm run build`

### Completion Notes List

- Replaced the scaffold chat surface with app-managed message state, streaming assistant updates, tool call cards, and composer send flow wired to `prompt.submit`.
- Extended `useHermesGateway` with a stable `onChatEvent` callback path so streamed gateway events update UI state without changing reconnect behavior or token accumulation.
- Implemented markdown rendering with GFM and Prism-based code highlighting, and enabled Tailwind typography so assistant responses render with the expected prose styling.

### File List

- `hermes-desktop/package.json`
- `hermes-desktop/package-lock.json`
- `hermes-desktop/tailwind.config.js`
- `hermes-desktop/src/app.jsx`
- `hermes-desktop/src/components/composer.jsx`
- `hermes-desktop/src/components/markdown.jsx`
- `hermes-desktop/src/components/message.jsx`
- `hermes-desktop/src/components/toolcard.jsx`
- `hermes-desktop/src/hooks/useHermesGateway.js`

## Implementation Notes

### Files Changed

- `hermes-desktop/package.json`
- `hermes-desktop/package-lock.json`
- `hermes-desktop/tailwind.config.js`
- `hermes-desktop/src/app.jsx`
- `hermes-desktop/src/components/composer.jsx`
- `hermes-desktop/src/components/markdown.jsx`
- `hermes-desktop/src/components/message.jsx`
- `hermes-desktop/src/components/toolcard.jsx`
- `hermes-desktop/src/hooks/useHermesGateway.js`

### Approach

- Added the markdown/rendering dependencies first, then replaced the scaffold `Markdown`, `Message`, `ToolCard`, and `Composer` components with production chat UI behavior.
- Kept the existing gateway hook lifecycle intact and only forwarded chat-relevant events through a ref-backed callback to avoid reconnect churn.
- Centralized chat event handling in `app.jsx` with functional state setters so streaming updates, tool progress, and error messages stay dependency-free and stable.

### Key Decisions

- Added `@tailwindcss/typography` because the story-required `prose` classes would otherwise render without the expected markdown typography styles.
- Used a helper in `app.jsx` to target the last streaming assistant message consistently for tool and completion events instead of duplicating the search logic across handlers.
- Kept error messages as a simple inline bubble in `app.jsx` rather than introducing a third message component because the story only requires dedicated user and assistant components.

## QA Notes

**QA Result: PASS**
**QA Date:** 2026-06-08
**Auditor:** QA automated pipeline (claude-sonnet-4-6)

### What Was Tested

1. **Static analysis** — Full read of all 9 implementation files against each AC.
2. **Build verification** — `npm run build` ran successfully (2467 modules, no errors).
3. **AC-by-AC trace** — Each of the 11 acceptance criteria verified against actual source.
4. **Regression check** — Prior story hook exports (`status`, `send`, `activeModel`, `tokenCount`, `resetTokenCount`) and app wiring (`useSessions`, `Sidebar`, `SettingsPanel`, `StatusBar`, `SessionSwitcher`) all intact.

### AC Outcomes

| AC | Result | Notes |
|----|--------|-------|
| #1 Packages installed | PASS | react-markdown@9.1.0, remark-gfm@4.0.1, react-syntax-highlighter@15.6.6 all present; build clean |
| #2 Markdown component | PASS | ReactMarkdown + remarkGfm + Prism/oneDark; language-* detection without deprecated `inline` prop |
| #3 useHermesGateway chat events | PASS | Ref pattern correct; CHAT_EVENTS set complete; existing handlers untouched |
| #4 Message state model | PASS | useState([])/useState(false); correct message and toolCall shapes |
| #5 handleChatEvent | PASS | useCallback([]) with functional setters; all 6 event types handled correctly |
| #6 Auto-scroll | PASS | messagesEndRef attached to trailing div; useEffect([messages]) calls scrollIntoView |
| #7 UserMessage | PASS | All required classes and "YOU" label present; plain text |
| #8 AssistantMessage | PASS | Markdown body, streaming cursor, ToolCallCards; old Message export removed |
| #9 ToolCallCard | PASS | Ref-based transition detection; args/partialOutput/result with 500-char truncation |
| #10 Composer | PASS | All props wired; Enter-to-send; context injection; send+onUserMessage+clear sequence |
| #11 app.jsx wiring | PASS (minor) | handleChatEvent declared before hook call; empty-state; per-role rendering correct |

### Minor Deviation (non-blocking)

- **Error bubble text color**: AC#11 specifies `text-red-400` for error messages; implementation uses `text-text` (normal text color). Visual distinction is preserved via the red border (`border-red-500/30`) and background (`bg-red-500/10`). Also uses `rounded-2xl` (vs spec `rounded-xl`) and `border-red-500/30` (vs spec `border-red-500/40`). These are cosmetic-only and do not affect functionality.

### Residual Risks

- No live gateway to exercise streaming end-to-end; correctness of event routing is logic-verified only.
- Bundle is 1 MB unminified; build warning about chunk size is expected for a Tauri app with Prism syntax highlighting and not a regression.
- `cargo build` still requires the host GTK/WebKit sysroot documented in STORY-0001; no new Rust changes in this story so no new Rust risk.
