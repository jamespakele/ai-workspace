// Mock data for Hermes Desktop — projects, file tree, sessions, slash commands, and the
// initial conversation thread. Treated as if it came over the ws://localhost:8765 gateway.

const PROJECTS = [
  { id: "gw", name: "hermes-gateway", path: "~/code/hermes-gateway", active: true },
  { id: "orca", name: "rust-orca", path: "~/code/rust-orca" },
  { id: "site", name: "nous-site", path: "~/work/nous-site" },
  { id: "scratch", name: "scratch", path: "~/scratch" },
];

// File tree for the active project. dim=true → greyed (gitignored-ish)
const FILE_TREE = [
  { type: "dir", name: "gateway", open: true, children: [
    { type: "file", name: "__init__.py" },
    { type: "file", name: "client.py", active: true },
    { type: "file", name: "server.py" },
    { type: "file", name: "protocol.py" },
    { type: "dir", name: "handlers", open: false, children: [
      { type: "file", name: "chat.py" },
      { type: "file", name: "tools.py" },
    ] },
  ] },
  { type: "dir", name: "tests", open: true, children: [
    { type: "file", name: "test_client.py", active: true },
    { type: "file", name: "test_server.py" },
  ] },
  { type: "dir", name: ".git", open: false, dim: true, children: [] },
  { type: "dir", name: "__pycache__", open: false, dim: true, children: [] },
  { type: "file", name: "pyproject.toml" },
  { type: "file", name: "README.md" },
];

const SESSIONS = [
  { id: "a1f", title: "Reconnect logic + status surface", when: "now", tokens: "18.4k", active: true },
  { id: "9c2", title: "Protocol framing v2 migration", when: "2h ago", tokens: "44.1k" },
  { id: "7b8", title: "Tool handler timeout bug", when: "yesterday", tokens: "31.7k" },
  { id: "4d0", title: "Initial gateway scaffold", when: "Mon", tokens: "62.0k" },
  { id: "2e5", title: "pytest fixtures cleanup", when: "Mon", tokens: "9.3k" },
];

const SLASH_COMMANDS = [
  { cmd: "/read", icon: "Read", desc: "Read a file into context" },
  { cmd: "/edit", icon: "Edit", desc: "Propose an edit to a file" },
  { cmd: "/run", icon: "Terminal", desc: "Run a shell command in the project" },
  { cmd: "/grep", icon: "Search2", desc: "Search the codebase for a pattern" },
  { cmd: "/test", icon: "Check", desc: "Run the project test suite" },
  { cmd: "/diff", icon: "Git", desc: "Show working-tree changes" },
  { cmd: "/model", icon: "Cube", desc: "Switch the active model" },
  { cmd: "/clear", icon: "X", desc: "Start a fresh session" },
];

const MODELS = [
  { id: "sonnet", name: "claude-sonnet-4-6", provider: "anthropic", group: "Anthropic" },
  { id: "opus", name: "claude-opus-4-1", provider: "anthropic", group: "Anthropic" },
  { id: "haiku", name: "claude-haiku-4", provider: "anthropic", group: "Anthropic" },
  { id: "deepseek", name: "deepseek-v3", provider: "openrouter", group: "OpenRouter" },
  { id: "qwen", name: "qwen2.5-coder:32b", provider: "ollama", group: "Ollama (local)" },
  { id: "llama", name: "llama3.3:70b", provider: "ollama", group: "Ollama (local)" },
];

// ---- The conversation thread ----------------------------------------------
// Each message: { id, role: 'user'|'assistant', blocks: [...] }
// Block types: text, thinking, tool, code
const INITIAL_MESSAGES = [
  {
    id: "m1", role: "user",
    attachments: [{ name: "gateway/client.py", kind: "file" }],
    blocks: [
      { type: "text", md: "The WebSocket client drops silently when the gateway restarts — the UI just freezes. Add automatic reconnection with exponential backoff, and surface the live connection state so the status bar can show it." },
    ],
  },
  {
    id: "m2", role: "assistant",
    blocks: [
      { type: "thinking", collapsed: true, md: "The current `GatewayClient` opens a single websocket and awaits messages in a loop. When the socket closes it raises and the loop exits with no recovery. I'll:\n1. Wrap the connect loop in a supervisor that retries with exponential backoff + jitter\n2. Add a `ConnectionState` enum and an observer callback so the UI can subscribe\n3. Reset backoff on a successful handshake\nLet me read the current client first to match its style." },
      { type: "text", md: "Here's the plan:\n\n- Wrap the connect loop in a **supervisor** that retries with exponential backoff + jitter\n- Add a `ConnectionState` enum (`CONNECTING · ONLINE · RETRYING · OFFLINE`) with an observer callback the UI can subscribe to\n- Reset the backoff window on a successful handshake\n\nReading the current client to match its conventions." },
      { type: "tool", tool: "Read", title: "client.py", subtitle: "gateway/client.py · 84 lines", status: "done",
        body: { kind: "read", lines: [
          { n: 12, t: "class GatewayClient:" },
          { n: 13, t: "    def __init__(self, url: str):" },
          { n: 14, t: "        self.url = url" },
          { n: 15, t: "        self._ws = None" },
          { n: 28, t: "    async def _run(self):" },
          { n: 29, t: "        self._ws = await websockets.connect(self.url)" },
          { n: 30, t: "        async for raw in self._ws:" },
          { n: 31, t: "            await self._dispatch(raw)" },
        ] } },
      { type: "text", md: "It's a single-shot `_run`. I'll add a `ConnectionState`, a supervisor loop, and emit state transitions through `self.on_state`." },
      { type: "tool", tool: "Edit", title: "client.py", subtitle: "gateway/client.py · +37 −4", status: "done",
        body: { kind: "diff", hunk: "@@ -26,9 +26,42 @@ class GatewayClient:", lines: [
          { sign: "+", t: "    BACKOFF_MAX = 30.0" },
          { sign: "+", t: "" },
          { sign: "+", t: "    async def _supervise(self):" },
          { sign: "+", t: "        delay = 0.5" },
          { sign: "+", t: "        while not self._closing:" },
          { sign: "+", t: "            try:" },
          { sign: "+", t: "                self._set_state(State.CONNECTING)" },
          { sign: "+", t: "                await self._run()" },
          { sign: "+", t: "            except (ConnectionClosed, OSError):" },
          { sign: "+", t: "                self._set_state(State.RETRYING)" },
          { sign: "+", t: "                jitter = random.uniform(0, delay * 0.3)" },
          { sign: "+", t: "                await asyncio.sleep(delay + jitter)" },
          { sign: "+", t: "                delay = min(delay * 2, self.BACKOFF_MAX)" },
          { sign: " ", t: "    async def _run(self):" },
          { sign: "-", t: "        self._ws = await websockets.connect(self.url)" },
          { sign: "+", t: "        self._ws = await websockets.connect(self.url)" },
          { sign: "+", t: "        self._set_state(State.ONLINE)" },
          { sign: "+", t: "        delay = 0.5  # reset backoff on success" },
        ] } },
      { type: "tool", tool: "Terminal", title: "pytest tests/test_client.py -q", subtitle: "exit 0 · 1.84s", status: "done",
        body: { kind: "terminal", lines: [
          "$ pytest tests/test_client.py -q",
          "........                                          [100%]",
          "",
          "8 passed in 1.84s",
        ] } },
      { type: "text", stream: true, md: "Done. The client now supervises its own connection:\n\n- **`ConnectionState`** transitions are emitted via `on_state(cb)` — subscribe to it from the UI to drive the status-bar dot.\n- Backoff starts at **500 ms**, doubles up to a **30 s** ceiling, with ±30% jitter to avoid thundering-herd on a gateway restart.\n- The window **resets** the moment a handshake succeeds, so a brief blip recovers instantly.\n\nWire the status bar to the observer like this:\n\n```python\nclient.on_state(lambda s: status_bar.set_connection(s))\n```\n\nWant me to add a visible *“reconnecting…”* toast in the chat view when state is `RETRYING`, or keep all connection feedback in the status bar?" },
    ],
  },
];

Object.assign(window, { PROJECTS, FILE_TREE, SESSIONS, SLASH_COMMANDS, MODELS, INITIAL_MESSAGES });
