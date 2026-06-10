import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { StatusBar } from "./statusbar";

function renderBar(overrides = {}) {
  render(
    <StatusBar
      gatewayStatus="connected"
      activeModel="hermes-4"
      activeSessionId="sess_abcdef123"
      tokenCount={0}
      contextWindow={200_000}
      onSettingsOpen={() => {}}
      {...overrides}
    />,
  );
}

describe("StatusBar", () => {
  it("shows context usage percentage", () => {
    renderBar({ tokenCount: 20_000 });
    expect(screen.getByTestId("context-usage")).toHaveTextContent("ctx 10%");
  });

  it("colors usage by severity", () => {
    renderBar({ tokenCount: 190_000 });
    expect(screen.getByTestId("context-usage")).toHaveClass("text-red-400");
  });

  it("keeps the raw token count visible", () => {
    renderBar({ tokenCount: 1234 });
    expect(screen.getByText(/tokens: 1,234/)).toBeInTheDocument();
  });
});
