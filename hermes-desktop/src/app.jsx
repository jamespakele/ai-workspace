import { useCallback, useEffect, useRef, useState } from "react";

import { Sidebar } from "./components/sidebar";
import { SettingsPanel } from "./components/settings";
import { StatusBar } from "./components/statusbar";
import { UserMessage, AssistantMessage } from "./components/message";
import { Composer } from "./components/composer";
import { SessionSwitcher } from "./components/session-switcher";
import { ApprovalCard } from "./components/approval-card";
import { PlanPanel } from "./components/plan-panel";
import { PreviewPane } from "./components/preview-pane";
import { useHermesGateway } from "./hooks/useHermesGateway";
import { useSessions } from "./hooks/useSessions";
import { useSkills } from "./hooks/useSkills";
import { useScheduledTasks } from "./hooks/useScheduledTasks";
import { useAppConfig } from "./hooks/useAppConfig";
import { collectOutputs } from "./lib/outputs";

function updateLastStreamingAssistant(messages, updater) {
  const next = [...messages];

  for (let index = next.length - 1; index >= 0; index -= 1) {
    const message = next[index];
    if (message.role === "assistant" && message.isStreaming) {
      next[index] = updater(message);
      return next;
    }
  }

  return messages;
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingContextPath, setPendingContextPath] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [mode, setMode] = useState("ask");
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [plan, setPlan] = useState(null);
  const [outputs, setOutputs] = useState([]);
  const [previewPath, setPreviewPath] = useState(null);
  const [sidebarTab, setSidebarTab] = useState("files");
  const [scheduleCreateOpen, setScheduleCreateOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const modeRef = useRef(mode);
  const sendRef = useRef(null);
  const sessionAllowedToolsRef = useRef(new Set());
  // Tool metadata from tool.start, so tool.complete can resolve output paths.
  const toolCallMetaRef = useRef(new Map());

  modeRef.current = mode;

  const handleChatEvent = useCallback((event) => {
    switch (event.event) {
      case "message.delta": {
        const delta = event.data?.delta ?? "";
        const messageId = event.data?.message_id ?? crypto.randomUUID();

        setMessages((previous) => {
          const next = [...previous];
          const lastMessage = next.at(-1);

          if (lastMessage?.role === "assistant" && lastMessage.isStreaming) {
            next[next.length - 1] = {
              ...lastMessage,
              content: `${lastMessage.content}${delta}`,
            };
            return next;
          }

          return [
            ...previous,
            {
              id: messageId,
              role: "assistant",
              content: delta,
              toolCalls: [],
              isStreaming: true,
            },
          ];
        });
        setIsStreaming(true);
        break;
      }
      case "tool.start": {
        const toolCallId = event.data?.tool_call_id ?? crypto.randomUUID();
        const toolName = event.data?.tool_name ?? "";
        const args = event.data?.args ?? {};

        toolCallMetaRef.current.set(toolCallId, { name: toolName, args });

        setMessages((previous) =>
          updateLastStreamingAssistant(previous, (message) => ({
            ...message,
            toolCalls: [
              ...message.toolCalls,
              {
                id: toolCallId,
                name: toolName,
                args,
                partialOutput: "",
                result: null,
                status: "running",
              },
            ],
          })),
        );
        break;
      }
      case "tool.progress": {
        setMessages((previous) =>
          updateLastStreamingAssistant(previous, (message) => ({
            ...message,
            toolCalls: message.toolCalls.map((toolCall) =>
              toolCall.id === event.data?.tool_call_id
                ? {
                    ...toolCall,
                    partialOutput: event.data?.output ?? "",
                  }
                : toolCall,
            ),
          })),
        );
        break;
      }
      case "tool.complete": {
        const toolCallId = event.data?.tool_call_id;
        const meta = toolCallMetaRef.current.get(toolCallId);

        if (meta) {
          toolCallMetaRef.current.delete(toolCallId);
          setOutputs((previous) =>
            collectOutputs(previous, [
              { name: meta.name, args: meta.args, status: "done" },
            ]),
          );
        }

        setMessages((previous) =>
          updateLastStreamingAssistant(previous, (message) => ({
            ...message,
            toolCalls: message.toolCalls.map((toolCall) =>
              toolCall.id === event.data?.tool_call_id
                ? {
                    ...toolCall,
                    result: event.data?.result ?? "",
                    status: "done",
                  }
                : toolCall,
            ),
          })),
        );
        break;
      }
      case "message.complete": {
        setMessages((previous) =>
          updateLastStreamingAssistant(previous, (message) => ({
            ...message,
            isStreaming: false,
          })),
        );
        setIsStreaming(false);
        break;
      }
      case "permission.request": {
        const request = event.data ?? {};

        // Auto mode and session-allowed tools skip the prompt, mirroring
        // Cowork's autonomy modes.
        if (
          modeRef.current === "auto" ||
          sessionAllowedToolsRef.current.has(request.tool_name)
        ) {
          sendRef.current?.("permission.respond", {
            request_id: request.request_id,
            decision: "allow_once",
          });
          break;
        }

        setPendingApprovals((previous) => [...previous, request]);
        break;
      }
      case "plan.update": {
        setPlan(event.data ?? null);
        break;
      }
      case "session.error":
        setMessages((previous) => [
          ...previous,
          {
            id: crypto.randomUUID(),
            role: "error",
            content: event.data?.message ?? "Gateway error",
            toolCalls: [],
            isStreaming: false,
          },
        ]);
        setIsStreaming(false);
        break;
      default:
        break;
    }
  }, []);
  const {
    status: gatewayStatus,
    activeModel,
    tokenCount,
    send,
    resetTokenCount,
  } = useHermesGateway({ onChatEvent: handleChatEvent });
  const { sessions, activeSessionId, setActiveSessionId } = useSessions();
  const { skills } = useSkills();
  const { config } = useAppConfig();
  const {
    tasks: scheduledTasks,
    addTask,
    removeTask,
    toggleTask,
  } = useScheduledTasks({ send });

  sendRef.current = send;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // A different session means a fresh task surface: per-session approvals,
  // plan, and outputs no longer apply.
  useEffect(() => {
    sessionAllowedToolsRef.current = new Set();
    toolCallMetaRef.current = new Map();
    setPendingApprovals([]);
    setPlan(null);
    setOutputs([]);
  }, [activeSessionId]);

  const handleApprovalResponse = (request, decision) => {
    if (decision === "allow_session" && request.tool_name) {
      sessionAllowedToolsRef.current.add(request.tool_name);
    }

    send("permission.respond", {
      request_id: request.request_id,
      decision,
    });
    setPendingApprovals((previous) =>
      previous.filter((pending) => pending.request_id !== request.request_id),
    );
  };

  const handleCompact = () => {
    send("session.compact", { session_id: activeSessionId });
    resetTokenCount();
  };

  const handleOpenSchedule = () => {
    setSidebarTab("scheduled");
    setScheduleCreateOpen(true);
  };

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
              setActiveSessionId={setActiveSessionId}
              send={send}
              resetTokenCount={resetTokenCount}
            />
          </header>
          <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            {messages.length === 0 ? (
              <p className="mt-16 text-center text-sm text-muted">
                Start a conversation.
              </p>
            ) : null}
            <PlanPanel plan={plan} />
            {messages.map((message) => (
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
              )
            ))}
            {pendingApprovals.map((request) => (
              <ApprovalCard
                key={request.request_id}
                request={request}
                onRespond={handleApprovalResponse}
              />
            ))}
            <div ref={messagesEndRef} />
          </section>
          <Composer
            pendingContextPath={pendingContextPath}
            onContextInjected={() => setPendingContextPath(null)}
            isStreaming={isStreaming}
            send={send}
            activeSessionId={activeSessionId}
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
        gatewayStatus={gatewayStatus}
        activeModel={activeModel}
        activeSessionId={activeSessionId}
        tokenCount={tokenCount}
        contextWindow={config?.context_window ?? undefined}
        onSettingsOpen={() => setSettingsOpen(true)}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
