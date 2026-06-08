export function useHermesGateway() {
  return {
    status: "idle",
    connect: async () => {},
    disconnect: async () => {},
    send: async () => {},
  };
}
