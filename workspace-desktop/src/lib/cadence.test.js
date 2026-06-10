import { describe, expect, it } from "vitest";

import { computeNextRun, isDue, parseCadence } from "./cadence";

describe("parseCadence", () => {
  it("parses hourly", () => {
    expect(parseCadence("hourly")).toEqual({ kind: "hourly" });
  });

  it("parses daily with time", () => {
    expect(parseCadence("daily@09:30")).toEqual({
      kind: "daily",
      hour: 9,
      minute: 30,
    });
  });

  it("parses weekly with day and time", () => {
    expect(parseCadence("weekly:mon@08:00")).toEqual({
      kind: "weekly",
      day: 1,
      hour: 8,
      minute: 0,
    });
  });

  it("parses every-N-minutes", () => {
    expect(parseCadence("every:15m")).toEqual({ kind: "every", minutes: 15 });
  });

  it("is case- and whitespace-tolerant", () => {
    expect(parseCadence(" Daily@07:05 ")).toEqual({
      kind: "daily",
      hour: 7,
      minute: 5,
    });
  });

  it("rejects invalid specs", () => {
    expect(parseCadence("daily@25:00")).toBeNull();
    expect(parseCadence("daily@09:75")).toBeNull();
    expect(parseCadence("weekly:xyz@09:00")).toBeNull();
    expect(parseCadence("every:0m")).toBeNull();
    expect(parseCadence("sometimes")).toBeNull();
    expect(parseCadence(undefined)).toBeNull();
  });
});

describe("computeNextRun", () => {
  it("hourly rolls to the next top of hour", () => {
    const after = new Date(2026, 5, 10, 14, 25, 0);
    expect(computeNextRun("hourly", after)).toEqual(
      new Date(2026, 5, 10, 15, 0, 0),
    );
  });

  it("daily runs later today when the time has not passed", () => {
    const after = new Date(2026, 5, 10, 6, 0, 0);
    expect(computeNextRun("daily@09:00", after)).toEqual(
      new Date(2026, 5, 10, 9, 0, 0),
    );
  });

  it("daily rolls to tomorrow when the time has passed", () => {
    const after = new Date(2026, 5, 10, 10, 0, 0);
    expect(computeNextRun("daily@09:00", after)).toEqual(
      new Date(2026, 5, 11, 9, 0, 0),
    );
  });

  it("weekly wraps to next week when today's slot has passed", () => {
    // 2026-06-10 is a Wednesday.
    const after = new Date(2026, 5, 10, 12, 0, 0);
    expect(computeNextRun("weekly:wed@09:00", after)).toEqual(
      new Date(2026, 5, 17, 9, 0, 0),
    );
  });

  it("weekly finds the upcoming weekday", () => {
    const after = new Date(2026, 5, 10, 12, 0, 0);
    expect(computeNextRun("weekly:fri@09:00", after)).toEqual(
      new Date(2026, 5, 12, 9, 0, 0),
    );
  });

  it("every-N adds the interval", () => {
    const after = new Date(2026, 5, 10, 12, 0, 0);
    expect(computeNextRun("every:30m", after)).toEqual(
      new Date(2026, 5, 10, 12, 30, 0),
    );
  });

  it("returns null for invalid specs", () => {
    expect(computeNextRun("nope", new Date())).toBeNull();
  });
});

describe("isDue", () => {
  const now = new Date(2026, 5, 10, 12, 0, 0);

  it("never-run tasks are due", () => {
    expect(
      isDue(
        { enabled: true, cadence: "daily@09:00", last_run: null },
        now,
      ),
    ).toBe(true);
  });

  it("disabled tasks are never due", () => {
    expect(
      isDue(
        { enabled: false, cadence: "daily@09:00", last_run: null },
        now,
      ),
    ).toBe(false);
  });

  it("a task run earlier today is not due again until tomorrow", () => {
    const ranAt = Math.floor(new Date(2026, 5, 10, 9, 0, 5).getTime() / 1000);
    expect(
      isDue({ enabled: true, cadence: "daily@09:00", last_run: ranAt }, now),
    ).toBe(false);
  });

  it("a task last run yesterday is due after today's slot", () => {
    const ranAt = Math.floor(new Date(2026, 5, 9, 9, 0, 5).getTime() / 1000);
    expect(
      isDue({ enabled: true, cadence: "daily@09:00", last_run: ranAt }, now),
    ).toBe(true);
  });

  it("invalid cadence is never due", () => {
    expect(
      isDue({ enabled: true, cadence: "bogus", last_run: null }, now),
    ).toBe(false);
  });
});
