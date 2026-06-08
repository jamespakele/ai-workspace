import { useCallback, useEffect, useRef, useState } from "react";

import { Sidebar } from "./components/sidebar";
import { SettingsPanel } from "./components/settings";
import { StatusBar } from "./components/statusbar";
import { UserMessage, AssistantMessage } from "./components/message";
import { Composer } from "./components/composer";
import { SessionSwitcher } from "./components/session-switcher";
import { useHermesGateway } from "./hooks/useHermesGateway";
import { useSessions } from "./hooks/useSessions";

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
  const messagesEndRef = useRef(null);
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
        setMessages((previous) =>
          updateLastStreamingAssistant(previous, (message) => ({
            ...message,
            toolCalls: [
              ...message.toolCalls,
              {
                id: event.data?.tool_call_id ?? crypto.randomUUID(),
                name: event.data?.tool_name ?? "",
                args: event.data?.args ?? {},
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-text">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar onAddToContext={(path) => setPendingContextPath(path)} />
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
          />
        </main>
      </div>
      <StatusBar
        gatewayStatus={gatewayStatus}
        activeModel={activeModel}
        activeSessionId={activeSessionId}
        tokenCount={tokenCount}
        onSettingsOpen={() => setSettingsOpen(true)}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
