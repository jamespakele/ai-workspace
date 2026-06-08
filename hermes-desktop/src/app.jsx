import { useState } from "react";

import { Sidebar } from "./components/sidebar";
import { SettingsPanel } from "./components/settings";
import { StatusBar } from "./components/statusbar";
import { Message } from "./components/message";
import { ToolCard } from "./components/toolcard";
import { Composer } from "./components/composer";
import { Markdown } from "./components/markdown";
import { SessionSwitcher } from "./components/session-switcher";
import { useHermesGateway } from "./hooks/useHermesGateway";
import { useSessions } from "./hooks/useSessions";

const messages = [
  {
    id: "message-1",
    role: "assistant",
    content:
      "Hermes Desktop scaffold is running. Backend commands, plugins, and layout regions are now stubbed for incremental feature work.",
  },
];

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingContextPath, setPendingContextPath] = useState(null);
  const {
    status: gatewayStatus,
    activeModel,
    tokenCount,
    send,
    resetTokenCount,
  } = useHermesGateway();
  const { sessions, activeSessionId, setActiveSessionId } = useSessions();

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
            <div className="rounded-2xl border border-border bg-panel/80 p-4">
              <Markdown content="Static scaffold for chat, tools, and composer." />
            </div>
            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
            <ToolCard
              toolName="spawn_gateway"
              status="stub"
              summary={`Gateway lifecycle is live. Current connection state: ${gatewayStatus}.`}
            />
          </section>
          <Composer pendingContextPath={pendingContextPath} />
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
