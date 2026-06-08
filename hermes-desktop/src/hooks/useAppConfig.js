import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const listeners = new Set();

const state = {
  config: null,
  loading: true,
  error: null,
  initialized: false,
};

function emit() {
  for (const listener of listeners) {
    listener({
      config: state.config,
      loading: state.loading,
      error: state.error,
    });
  }
}

async function loadConfig() {
  state.loading = true;
  state.error = null;
  emit();

  try {
    state.config = await invoke("get_config");
  } catch (error) {
    state.error = String(error);
  } finally {
    state.loading = false;
    emit();
  }
}

async function ensureLoaded() {
  if (state.initialized) {
    return;
  }

  state.initialized = true;
  await loadConfig();
}

export function useAppConfig() {
  const [snapshot, setSnapshot] = useState({
    config: state.config,
    loading: state.loading,
    error: state.error,
  });

  useEffect(() => {
    listeners.add(setSnapshot);
    void ensureLoaded();

    return () => {
      listeners.delete(setSnapshot);
    };
  }, []);

  const saveConfig = async (config) => {
    await invoke("save_config", { config });
    state.config = config;
    state.error = null;
    emit();
  };

  return {
    ...snapshot,
    saveConfig,
  };
}
