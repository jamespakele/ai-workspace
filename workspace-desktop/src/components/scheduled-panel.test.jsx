import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ScheduledPanel } from "./scheduled-panel";

const tasks = [
  {
    id: "t1",
    name: "Morning digest",
    prompt: "Summarize inbox",
    cadence: "daily@09:00",
    enabled: true,
    last_run: null,
  },
  {
    id: "t2",
    name: "Paused job",
    prompt: "p",
    cadence: "hourly",
    enabled: false,
    last_run: null,
  },
];

function renderPanel(overrides = {}) {
  const props = {
    tasks,
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onToggle: vi.fn(),
    createOpen: false,
    onCreateOpenChange: vi.fn(),
    ...overrides,
  };

  render(<ScheduledPanel {...props} />);
  return props;
}

describe("ScheduledPanel", () => {
  it("lists tasks with cadence and next run", () => {
    renderPanel();

    expect(screen.getByText("Morning digest")).toBeInTheDocument();
    expect(screen.getByText(/daily@09:00 · next:/)).toBeInTheDocument();
    expect(screen.getByText(/hourly · paused/)).toBeInTheDocument();
  });

  it("shows empty state without tasks", () => {
    renderPanel({ tasks: [] });
    expect(screen.getByText(/no scheduled tasks/i)).toBeInTheDocument();
  });

  it("creates a task from the form", async () => {
    const props = renderPanel({ createOpen: true });

    await userEvent.type(screen.getByLabelText("Task name"), "Weekly report");
    await userEvent.type(screen.getByLabelText("Task prompt"), "Write it");
    await userEvent.type(screen.getByLabelText("Task cadence"), "weekly:fri@16:00");
    await userEvent.click(screen.getByRole("button", { name: "Create task" }));

    expect(props.onAdd).toHaveBeenCalledWith({
      name: "Weekly report",
      prompt: "Write it",
      cadence: "weekly:fri@16:00",
    });
    expect(props.onCreateOpenChange).toHaveBeenCalledWith(false);
  });

  it("rejects an invalid cadence", async () => {
    const props = renderPanel({ createOpen: true });

    await userEvent.type(screen.getByLabelText("Task name"), "Bad");
    await userEvent.type(screen.getByLabelText("Task prompt"), "p");
    await userEvent.type(screen.getByLabelText("Task cadence"), "whenever");
    await userEvent.click(screen.getByRole("button", { name: "Create task" }));

    expect(screen.getByText(/invalid cadence/i)).toBeInTheDocument();
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it("toggles and deletes tasks", async () => {
    const props = renderPanel();

    await userEvent.click(
      screen.getByRole("button", { name: "Pause Morning digest" }),
    );
    expect(props.onToggle).toHaveBeenCalledWith("t1");

    await userEvent.click(
      screen.getByRole("button", { name: "Delete Paused job" }),
    );
    expect(props.onRemove).toHaveBeenCalledWith("t2");
  });
});
