import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mockCommand, resetInvokeMocks } from "../test/tauri-mock";

vi.mock("@tauri-apps/api/core", () => import("../test/tauri-mock"));

import { ConnectWizard } from "./connect-wizard";

const binaryInstance = {
  id: "binary:/usr/local/bin/hermes",
  kind: "binary",
  label: "/usr/local/bin/hermes",
  hermes_bin: "/usr/local/bin/hermes",
  gateway_url: "ws://localhost:8765",
  reachable: false,
};

const dockerInstance = {
  id: "docker:abc123",
  kind: "docker",
  label: "Docker: hermes-test (hermes:dev)",
  hermes_bin: null,
  gateway_url: "ws://localhost:32768",
  reachable: true,
};

function renderWizard(overrides = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    onConnect: vi.fn(),
    ...overrides,
  };

  render(<ConnectWizard {...props} />);
  return props;
}

describe("ConnectWizard", () => {
  beforeEach(() => {
    resetInvokeMocks();
  });

  it("scans on open and lists every discovered instance", async () => {
    mockCommand("discover_hermes", [binaryInstance, dockerInstance]);
    renderWizard();

    expect(await screen.findByText("/usr/local/bin/hermes")).toBeInTheDocument();
    expect(
      screen.getByText("Docker: hermes-test (hermes:dev)"),
    ).toBeInTheDocument();
    expect(screen.getByText("ws://localhost:32768")).toBeInTheDocument();
  });

  it("preselects the reachable instance when there are several", async () => {
    mockCommand("discover_hermes", [binaryInstance, dockerInstance]);
    renderWizard();

    await waitFor(() =>
      expect(
        screen.getByRole("radio", { name: /hermes-test/ }),
      ).toHaveAttribute("aria-checked", "true"),
    );
  });

  it("connects with the selected instance", async () => {
    mockCommand("discover_hermes", [binaryInstance, dockerInstance]);
    const props = renderWizard();

    await userEvent.click(
      await screen.findByRole("radio", { name: /usr\/local\/bin\/hermes/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(props.onConnect).toHaveBeenCalledWith(binaryInstance);
  });

  it("shows guidance when nothing is found", async () => {
    mockCommand("discover_hermes", []);
    renderWizard();

    expect(
      await screen.findByText(/no hermes installs or running gateways found/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
  });

  it("rescans on demand", async () => {
    let call = 0;
    mockCommand("discover_hermes", () => {
      call += 1;
      return call === 1 ? [] : [dockerInstance];
    });
    renderWizard();

    await screen.findByText(/no hermes installs/i);
    await userEvent.click(screen.getByRole("button", { name: "Rescan" }));

    expect(
      await screen.findByText("Docker: hermes-test (hermes:dev)"),
    ).toBeInTheDocument();
  });

  it("surfaces discovery errors", async () => {
    mockCommand("discover_hermes", () => {
      throw new Error("docker daemon unreachable");
    });
    renderWizard();

    expect(
      await screen.findByText(/docker daemon unreachable/),
    ).toBeInTheDocument();
  });
});
