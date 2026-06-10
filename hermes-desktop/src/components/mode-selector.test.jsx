import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ModeSelector } from "./mode-selector";

describe("ModeSelector", () => {
  it("marks the active mode as checked", () => {
    render(<ModeSelector mode="ask" onModeChange={() => {}} />);

    expect(
      screen.getByRole("radio", { name: "Ask before acting" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Auto" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("reports mode changes", async () => {
    const onModeChange = vi.fn();
    render(<ModeSelector mode="ask" onModeChange={onModeChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "Auto" }));
    expect(onModeChange).toHaveBeenCalledWith("auto");
  });
});
