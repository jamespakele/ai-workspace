import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mockCommand, resetInvokeMocks } from "../test/tauri-mock";

vi.mock("@tauri-apps/api/core", () => import("../test/tauri-mock"));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

import { SettingsPanel } from "./settings";

function storeBackedCommands(initial = []) {
  let stored = initial;
  mockCommand("list_mcp_servers", () => stored);
  mockCommand("save_mcp_servers", ({ servers }) => {
    stored = servers;
  });
  return () => stored;
}

describe("Settings connectors section", () => {
  beforeEach(() => {
    resetInvokeMocks();
    mockCommand("get_config", {
      hermes_bin: "",
      gateway_url: "ws://localhost:8765",
      auto_start_gateway: false,
      active_project: "",
    });
  });

  it("lists configured connectors", async () => {
    storeBackedCommands([
      {
        name: "slack",
        transport: "stdio",
        command: "npx slack-mcp",
        url: "",
        enabled: true,
      },
    ]);

    render(<SettingsPanel open onClose={() => {}} />);

    expect(await screen.findByText("slack")).toBeInTheDocument();
    expect(screen.getByText("npx slack-mcp")).toBeInTheDocument();
  });

  it("adds a connector through the form and shows the restart notice", async () => {
    const getStored = storeBackedCommands();
    render(<SettingsPanel open onClose={() => {}} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Add connector" }),
    );
    await userEvent.type(screen.getByLabelText("Connector name"), "gmail");
    await userEvent.type(
      screen.getByLabelText("Connector command"),
      "npx gmail-mcp",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Save connector" }),
    );

    await waitFor(() => expect(getStored()).toHaveLength(1));
    expect(getStored()[0]).toMatchObject({
      name: "gmail",
      transport: "stdio",
      enabled: true,
    });
    expect(
      screen.getByText(/restart gateway to apply connector changes/i),
    ).toBeInTheDocument();
  });

  it("removes a connector", async () => {
    const getStored = storeBackedCommands([
      {
        name: "slack",
        transport: "stdio",
        command: "npx slack-mcp",
        url: "",
        enabled: true,
      },
    ]);
    render(<SettingsPanel open onClose={() => {}} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Remove slack" }),
    );

    await waitFor(() => expect(getStored()).toHaveLength(0));
    expect(screen.getByText(/no connectors configured/i)).toBeInTheDocument();
  });

  it("toggles a connector off", async () => {
    const getStored = storeBackedCommands([
      {
        name: "slack",
        transport: "stdio",
        command: "npx slack-mcp",
        url: "",
        enabled: true,
      },
    ]);
    render(<SettingsPanel open onClose={() => {}} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Disable slack" }),
    );

    await waitFor(() => expect(getStored()[0].enabled).toBe(false));
  });
});
