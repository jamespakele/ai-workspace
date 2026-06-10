import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { Sidebar } from "./components/sidebar";
import { SettingsPanel } from "./components/settings";
import { StatusBar } from "./components/statusbar";
import { UserMessage, AssistantMessage } from "./components/message";
import { Composer } from "./components/composer";
import { SessionSwitcher } from "./components/session-switcher";
import { ConnectWizard } from "./components/connect-wizard";
import { PlanPanel } from "./components/plan-panel";
import { PreviewPane } from "./components/preview-pane";
import { useSessions } from "./hooks/useSessions";
import { useSkills } from "./hooks/useSkills";
import { useScheduledTasks } from "./hooks/useScheduledTasks";
import { useAppConfig } from "./hooks/useAppConfig";

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [pendingContextPath, setPendingContextPath] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [mode, setMode] = useState("ask");
  const [plan, setPlan] = useState(null);
  const [outputs, setOutputs] = useState([]);
  const [previewPath, setPreviewPath] = useState(null);
  const [sidebarTab, setSidebarTab] = useState("files");
  const [scheduleCreateOpen, setScheduleCreateOpen] = useState(false);
  const messagesEndRef = useRef(null);

  const { sessions, activeSessionId, setActiveSessionId, refresh } = useSessions();
  const { skills } = useSkills();
  const { config, saveConfig } = useAppConfig();
  const {
    tasks: scheduledTasks,
    addTask,
    removeTask,
    toggleTask,
  } = useScheduledTasks({});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset per-session state when switching sessions.
  useEffect(() => {
    setPlan(null);
    setOutputs([]);
  }, [activeSessionId]);

  // ── CLI-based chat: invoke("send_prompt") ──────────────────
  const handleSendPrompt = useCallback(
    async (text) => {
      setIsStreaming(true);

      try {
        const hermesBin =
          config?.hermes_bin || "/home/pakele/.local/bin/hermes";
        const projectDir = config?.project_dir || undefined;

        const result = await invoke("send_prompt", {
          hermesBin,
          text,
          sessionId: activeSessionId ?? "",
          cwd: projectDir ?? null,
        });

        // Store the session ID from the response for --resume on next message.
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

        // Refresh the session list so the sidebar shows the new/updated session.
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
    [activeSessionId, config, refresh, setActiveSessionId],
  );

  const handleCompact = () => {
    // Compact is handled by the CLI's built-in compression.
    // No-op in CLI mode — Hermes auto-compresses when needed.
  };

  const handleOpenSchedule = () => {
    setSidebarTab("scheduled");
    setScheduleCreateOpen(true);
  };

  const handleConnectInstance = async (instance) => {
    const next = {
      ...(config ?? {}),
      ...(instance.hermes_bin ? { hermes_bin: instance.hermes_bin } : {}),
    };

    try {
      await saveConfig(next);
      setConnectOpen(false);
    } catch (error) {
      console.error("connect failed:", error);
    }
  };

  // When resuming a session, load its history from the DB.
  const handleResumeSession = useCallback(
    async (sessionId) => {
      setActiveSessionId(sessionId);
      setMessages([]);
      setPlan(null);
      setOutputs([]);

      try {
        const history = await invoke("get_session_messages", {
          sessionId,
        });

        if (Array.isArray(history) && history.length > 0) {
          setMessages(
            history.map((message) => ({
              id: crypto.randomUUID(),
              role: message.role === "user" ? "user" : "assistant",
              content: message.content ?? "",
              toolCalls: [],
              isStreaming: false,
            })),
          );
        }
      } catch (error) {
        console.error("Failed to load session history:", error);
      }
    },
    [setActiveSessionId],
  );

  const handleNewSession = useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
    setPlan(null);
    setOutputs([]);
  }, [setActiveSessionId]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-text">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          onAddToContext={(path) => setPendingContextPath(path)}
          onOpenFile={(path) => setPreviewPath(path)}
          outputs={outputs}
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          scheduled={{
            tasks: scheduledTasks,
            onAdd: addTask,
            onRemove: removeTask,
            onToggle: toggleTask,
            createOpen: scheduleCreateOpen,
            onCreateOpenChange: setScheduleCreateOpen,
          }}
        />
        <main className="flex min-w-0 flex-1 flex-col bg-canvas">
          <header className="border-b border-border px-6 py-4">
            <SessionSwitcher
              sessions={sessions}
              activeSessionId={activeSessionId}
              onNewSession={handleNewSession}
              onResumeSession={handleResumeSession}
            />
          </header>
          <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            {messages.length === 0 ? (
              <p className="mt-16 text-center text-sm text-muted">
                Start a conversation.
              </p>
            ) : null}
            <PlanPanel plan={plan} />
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
                Hermes is thinking…
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </section>
          <Composer
            pendingContextPath={pendingContextPath}
            onContextInjected={() => setPendingContextPath(null)}
            isStreaming={isStreaming}
            onSendPrompt={handleSendPrompt}
            onUserMessage={(message) =>
              setMessages((previous) => [...previous, message])
            }
            mode={mode}
            onModeChange={setMode}
            skills={skills}
            onCompact={handleCompact}
            onOpenSchedule={handleOpenSchedule}
          />
        </main>
        {previewPath ? (
          <PreviewPane path={previewPath} onClose={() => setPreviewPath(null)} />
        ) : null}
      </div>
      <StatusBar
        gatewayStatus="cli"
        activeModel={null}
        activeSessionId={activeSessionId}
        tokenCount={0}
        contextWindow={config?.context_window ?? undefined}
        onSettingsOpen={() => setSettingsOpen(true)}
        onConnectOpen={() => setConnectOpen(true)}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <ConnectWizard
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnect={handleConnectInstance}
      />
    </div>
  );
}
