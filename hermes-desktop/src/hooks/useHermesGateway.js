import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const INITIAL_DELAY_MS = 500;
const MAX_DELAY_MS = 30_000;
const CHAT_EVENTS = new Set([
  "message.delta",
  "tool.start",
  "tool.progress",
  "tool.complete",
  "message.complete",
  "session.error",
  "permission.request",
  "plan.update",
]);

function parseMessage(data) {
  if (typeof data !== "string") {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function getReconnectDelay(attempt) {
  const baseDelay = Math.min(INITIAL_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  return baseDelay * (0.7 + Math.random() * 0.6);
}

export function useHermesGateway({ onChatEvent } = {}) {
  const [status, setStatus] = useState("connecting");
  const [activeModel, setActiveModel] = useState(null);
  const [tokenCount, setTokenCount] = useState(0);
  // Bumped by reconnect() to tear down the socket and re-read the config,
  // e.g. after the connect wizard switches instances.
  const [generation, setGeneration] = useState(0);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isUnmountedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const hasReachedCeilingRef = useRef(false);
  const configRef = useRef(null);
  const onChatEventRef = useRef(onChatEvent);

  useEffect(() => {
    onChatEventRef.current = onChatEvent;
  }, [onChatEvent]);

  useEffect(() => {
    let active = true;

    const cleanupSocket = () => {
      const socket = socketRef.current;
      if (!socket) {
        return;
      }

      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;

      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }

      socketRef.current = null;
    };

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (isUnmountedRef.current || !configRef.current) {
        return;
      }

      clearReconnectTimeout();

      const attempt = reconnectAttemptRef.current;
      const baseDelay = Math.min(INITIAL_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
      const delay = getReconnectDelay(attempt);

      reconnectAttemptRef.current += 1;

      if (baseDelay >= MAX_DELAY_MS) {
        hasReachedCeilingRef.current = true;
      }

      setStatus(hasReachedCeilingRef.current ? "disconnected" : "reconnecting");

      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectTimeoutRef.current = null;
        void connect();
      }, delay);
    };

    const handleEvent = (message) => {
      if (!message || typeof message !== "object") {
        return;
      }

      if (message.session?.model) {
        setActiveModel(message.session.model);
      }

      switch (message.event) {
        case "gateway.ready":
          setStatus("connected");
          break;
        case "model.changed":
          setActiveModel(message.data?.model ?? null);
          break;
        case "message.complete": {
          const inputTokens = Number(message.data?.input_tokens ?? 0);
          const outputTokens = Number(message.data?.output_tokens ?? 0);
          setTokenCount((current) => current + inputTokens + outputTokens);
          break;
        }
        default:
          break;
      }

      if (message.event && CHAT_EVENTS.has(message.event)) {
        onChatEventRef.current?.(message);
      }
    };

    const connect = async () => {
      if (isUnmountedRef.current || !configRef.current?.gateway_url) {
        return;
      }

      clearReconnectTimeout();
      cleanupSocket();

      setStatus(
        reconnectAttemptRef.current > 0 && !hasReachedCeilingRef.current
          ? "reconnecting"
          : "connecting",
      );

      const socket = new WebSocket(configRef.current.gateway_url);
      socketRef.current = socket;

      socket.onopen = () => {
        if (isUnmountedRef.current || socketRef.current !== socket) {
          return;
        }

        reconnectAttemptRef.current = 0;
        hasReachedCeilingRef.current = false;
        setStatus("connected");
      };

      socket.onmessage = (event) => {
        if (socketRef.current !== socket) {
          return;
        }

        const message = parseMessage(event.data);
        handleEvent(message);
      };

      socket.onerror = () => {
        if (socketRef.current !== socket) {
          return;
        }

        cleanupSocket();
        scheduleReconnect();
      };

      socket.onclose = () => {
        if (socketRef.current !== socket) {
          return;
        }

        cleanupSocket();
        scheduleReconnect();
      };
    };

    const initialize = async () => {
      try {
        const config = await invoke("get_config");
        if (!active) {
          return;
        }

        configRef.current = config;
        setActiveModel(config.session?.model ?? null);

        if (config.auto_start_gateway) {
          try {
            await invoke("spawn_gateway", { hermesBin: config.hermes_bin });
          } catch {
            // The gateway may already be running externally.
          }
        }

        void connect();
      } catch {
        if (!active) {
          return;
        }

        hasReachedCeilingRef.current = true;
        setStatus("disconnected");
      }
    };

    isUnmountedRef.current = false;
    reconnectAttemptRef.current = 0;
    hasReachedCeilingRef.current = false;
    setTokenCount(0);
    void initialize();

    return () => {
      active = false;
      isUnmountedRef.current = true;
      clearReconnectTimeout();
      cleanupSocket();
    };
  }, [generation]);

  const send = (method, params = {}) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify({ method, params }));
  };

  const resetTokenCount = useCallback(() => setTokenCount(0), []);

  const reconnect = useCallback(
    () => setGeneration((current) => current + 1),
    [],
  );

  return {
    status,
    send,
    activeModel,
    tokenCount,
    resetTokenCount,
    reconnect,
  };
}
