import { vi } from "vitest";

// Shared mock for @tauri-apps/api/core. Tests register per-command handlers,
// then import modules that call invoke().
export const invokeHandlers = new Map();

export const invoke = vi.fn(async (command, args) => {
  const handler = invokeHandlers.get(command);
  if (!handler) {
    throw new Error(`no mock handler registered for command "${command}"`);
  }
  return handler(args);
});

export function mockCommand(command, handler) {
  invokeHandlers.set(
    command,
    typeof handler === "function" ? handler : () => handler,
  );
}

export function resetInvokeMocks() {
  invokeHandlers.clear();
  invoke.mockClear();
}

export function convertFileSrc(path) {
  return `asset://localhost/${encodeURIComponent(path)}`;
}
