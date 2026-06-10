import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@/lib/api";

import { Sidebar } from "./components/sidebar";
import { SettingsPanel } from "./components/settings";
import { StatusBar } from "./components/statusbar";
import { UserMessage, AssistantMessage } from "./components/message";
import { Composer } from "./components/composer";
import { PreviewPane } from "./components/preview-pane";
import { useSessions } from "./hooks/useSessions";
import { useAppConfig } from "./hooks/useAppConfig";
import { useAgents } from "./hooks/useAgents";

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 480;
const DEFAULT_SIDEBAR_WIDTH = 260;

const MIN_PREVIEW_WIDTH = 260;
const MAX_PREVIEW_WIDTH = 640;
const DEFAULT_PREVIEW_WIDTH = 380;

/**
 * Scan agent response text for mentions of globally installed skills.
 * If a skill name appears, auto-scope it to the project (fire-and-forget).
 */
async function autoScopeDetectedSkills(responseText, projectDir) {
  try {
    const globalSkills = await invoke("list_global_skills");
    const projectSkills = await invoke("list_project_skills", { projectDir });
    const scopedNames = new Set(projectSkills.map((s) => s.name));
    const lower = responseText.toLowerCase();

    for (const skill of globalSkills) {
      if (scopedNames.has(skill.name)) {
        continue;
      }

      // Check if the skill name appears as a word boundary in the response.
      if (lower.includes(skill.name.toLowerCase())) {
        await invoke("scope_skill_to_project", {
          skillName: skill.name,
          projectDir,
        });
      }
    }
  } catch (err) {
    // Non-critical — don't break chat for a scoping failure.
    console.warn("Auto-scope skill detection failed:", err);
  }
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingContextPath, setPendingContextPath] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [previewPath, setPreviewPath] = useState(null);
  const messagesEndRef = useRef(null);

  // Resizable panels
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [previewWidth, setPreviewWidth] = useState(DEFAULT_PREVIEW_WIDTH);
  const resizingRef = useRef(null);

  const { activeSessionId, setActiveSessionId, refresh } = useSessions();
  const { config, saveConfig } = useAppConfig();
  const { agents } = useAgents();
  const activeAgent = config?.agent ?? "hermes";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Resize handlers ────────────────────────────────────────
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingRef.current) {
        return;
      }

      if (resizingRef.current.panel === "sidebar") {
        const newWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, e.clientX));
        setSidebarWidth(newWidth);
      } else if (resizingRef.current.panel === "preview") {
        const newWidth = Math.min(
          MAX_PREVIEW_WIDTH,
          Math.max(MIN_PREVIEW_WIDTH, window.innerWidth - e.clientX),
        );
        setPreviewWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const startSidebarResize = useCallback((e) => {
    e.preventDefault();
    resizingRef.current = { panel: "sidebar" };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const startPreviewResize = useCallback((e) => {
    e.preventDefault();
    resizingRef.current = { panel: "preview" };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  // ── CLI-based chat: invoke("send_prompt") ──────────────────
  const handleSendPrompt = useCallback(
    async (text) => {
      setIsStreaming(true);

      try {
        const hermesBin =
          config?.hermes_bin || "/home/pakele/.local/bin/hermes";
        const projectDir = config?.active_project || undefined;

        const result = await invoke("send_prompt", {
          agent: activeAgent,
          hermesBin,
          text,
          sessionId: activeSessionId ?? "",
          cwd: projectDir ?? null,
        });

        if (result.session_id) {
          setActiveSessionId(result.session_id);
        }

        setMessages((previous) => [
          ...previous,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: result.response,
            toolCalls: [],
            isStreaming: false,
          },
        ]);

        // Auto-detect: if the response mentions a globally installed skill,
        // auto-scope it to the project so the agent has it on next prompt.
        if (config?.active_project && result.response) {
          autoScopeDetectedSkills(result.response, config.active_project);
        }

        refresh();
      } catch (error) {
        setMessages((previous) => [
          ...previous,
          {
            id: crypto.randomUUID(),
            role: "error",
            content: String(error),
            toolCalls: [],
            isStreaming: false,
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [activeSessionId, activeAgent, config, refresh, setActiveSessionId],
  );

  const handleAgentChange = useCallback(
    async (agentName) => {
      if (config) {
        await saveConfig({ ...config, agent: agentName });
      }
    },
    [config, saveConfig],
  );

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-text">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar — Project tree */}
        <Sidebar
          onAddToContext={(path) => setPendingContextPath(path)}
          onOpenFile={(path) => setPreviewPath(path)}
          width={sidebarWidth}
          onResizeStart={startSidebarResize}
        />

        {/* Main chat area */}
        <main className="flex min-w-0 flex-1 flex-col bg-canvas">
          <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            {messages.length === 0 ? (
              <p className="mt-16 text-center text-sm text-muted">
                Start a conversation.
              </p>
            ) : null}
            {messages.map((message) =>
              message.role === "user" ? (
                <UserMessage key={message.id} message={message} />
              ) : message.role === "assistant" ? (
                <AssistantMessage key={message.id} message={message} />
              ) : (
                <article
                  key={message.id}
                  className="max-w-3xl rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-text"
                >
                  {message.content}
                </article>
              ),
            )}
            {isStreaming ? (
              <div className="flex items-center gap-3 px-4 py-3 text-sm text-muted">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                {activeAgent} is thinking…
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </section>

          {/* Composer with agent info */}
          <Composer
            pendingContextPath={pendingContextPath}
            onContextInjected={() => setPendingContextPath(null)}
            isStreaming={isStreaming}
            onSendPrompt={handleSendPrompt}
            onUserMessage={(message) =>
              setMessages((previous) => [...previous, message])
            }
            agents={agents}
            activeAgent={activeAgent}
            onAgentChange={handleAgentChange}
          />
        </main>

        {/* Preview pane — resizable */}
        {previewPath ? (
          <div className="relative flex shrink-0" style={{ width: `${previewWidth}px` }}>
            <div
              className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-accent/30 active:bg-accent/50"
              onMouseDown={startPreviewResize}
            />
            <PreviewPane path={previewPath} onClose={() => setPreviewPath(null)} />
          </div>
        ) : null}
      </div>

      {/* Minimal status bar — just settings gear */}
      <StatusBar
        onSettingsOpen={() => setSettingsOpen(true)}
      />

      {/* Settings dialog (includes workspace config) */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
