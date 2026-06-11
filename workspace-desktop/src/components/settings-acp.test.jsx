import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mockCommand, resetInvokeMocks } from "../test/tauri-mock";

vi.mock("@tauri-apps/api/core", () => import("../test/tauri-mock"));
vi.mock("@/lib/api", () => import("../test/tauri-mock"));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

import { SettingsPanel } from "./settings";

const BASE_CONFIG = {
  hermes_bin: "/usr/bin/hermes",
  gateway_url: "ws://localhost:8765",
  auto_start_gateway: false,
  active_project: "",
  agent: "claude",
  context_window: null,
  acp_enabled: true,
  acp_auto_approve: false,
  acp_launch_overrides: {},
};

describe("Settings ACP section", () => {
  beforeEach(() => {
    resetInvokeMocks();
    mockCommand("get_config", BASE_CONFIG);
    mockCommand("list_mcp_servers", []);
    mockCommand("save_mcp_servers", () => {});
  });

  it("shows the ACP toggles reflecting the loaded config", async () => {
    render(<SettingsPanel open onClose={() => {}} />);

    const acpToggle = await screen.findByRole("checkbox", {
      name: /use agent client protocol/i,
    });
    const approveToggle = screen.getByRole("checkbox", {
      name: /auto-approve acp permission requests/i,
    });

    await waitFor(() => expect(acpToggle).toBeChecked());
    expect(approveToggle).not.toBeChecked();
  });

  it("persists toggle changes through save_config", async () => {
    let saved = null;
    mockCommand("save_config", ({ config }) => {
      saved = config;
    });

    render(<SettingsPanel open onClose={() => {}} />);

    const approveToggle = await screen.findByRole("checkbox", {
      name: /auto-approve acp permission requests/i,
    });
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: /use agent client protocol/i }),
      ).toBeChecked(),
    );

    await userEvent.click(approveToggle);
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved.acp_auto_approve).toBe(true);
    expect(saved.acp_enabled).toBe(true);
  });
});
