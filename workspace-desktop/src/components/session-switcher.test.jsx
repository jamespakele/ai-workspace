import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SessionSwitcher } from "./session-switcher";

const sessions = [
  {
    id: "s1",
    title: "Quarterly budget review",
    preview: "",
    started_at: 1_780_000_000,
    total_tokens: 100,
  },
  {
    id: "s2",
    title: "",
    preview: "Organize downloads folder",
    started_at: 1_780_000_000,
    total_tokens: 50,
  },
];

async function openSwitcher(overrides = {}) {
  const props = {
    sessions,
    activeSessionId: null,
    setActiveSessionId: vi.fn(),
    send: vi.fn(),
    resetTokenCount: vi.fn(),
    ...overrides,
  };

  render(<SessionSwitcher {...props} />);
  await userEvent.click(screen.getByRole("button", { name: /switch/i }));
  return props;
}

describe("SessionSwitcher search", () => {
  it("filters sessions by title", async () => {
    await openSwitcher();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search sessions" }),
      "budget",
    );

    expect(screen.getByText("Quarterly budget review")).toBeInTheDocument();
    expect(
      screen.queryByText("Organize downloads folder"),
    ).not.toBeInTheDocument();
  });

  it("matches against the preview text too", async () => {
    await openSwitcher();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search sessions" }),
      "downloads",
    );

    expect(screen.getByText("Organize downloads folder")).toBeInTheDocument();
    expect(
      screen.queryByText("Quarterly budget review"),
    ).not.toBeInTheDocument();
  });

  it("restores the full list when cleared", async () => {
    await openSwitcher();
    const input = screen.getByRole("searchbox", { name: "Search sessions" });

    await userEvent.type(input, "budget");
    await userEvent.clear(input);

    expect(screen.getByText("Quarterly budget review")).toBeInTheDocument();
    expect(screen.getByText("Organize downloads folder")).toBeInTheDocument();
  });

  it("shows a no-match message", async () => {
    await openSwitcher();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search sessions" }),
      "zzz",
    );

    expect(screen.getByText(/no sessions match/i)).toBeInTheDocument();
  });
});
