import { describe, expect, it } from "vitest";

import {
  computeContextUsage,
  DEFAULT_CONTEXT_WINDOW,
} from "./context-usage";

describe("computeContextUsage", () => {
  it("reports ok at low usage", () => {
    expect(computeContextUsage(20_000, 200_000)).toEqual({
      percent: 10,
      level: "ok",
    });
  });

  it("reports warn at 70%", () => {
    expect(computeContextUsage(140_000, 200_000)).toEqual({
      percent: 70,
      level: "warn",
    });
  });

  it("reports critical at 90%", () => {
    expect(computeContextUsage(180_000, 200_000)).toEqual({
      percent: 90,
      level: "critical",
    });
  });

  it("clamps over-limit usage to 100%", () => {
    expect(computeContextUsage(500_000, 200_000)).toEqual({
      percent: 100,
      level: "critical",
    });
  });

  it("treats negative or non-numeric tokens as zero", () => {
    expect(computeContextUsage(-5, 200_000).percent).toBe(0);
    expect(computeContextUsage(NaN, 200_000).percent).toBe(0);
  });

  it("falls back to the default window for bad limits", () => {
    const usage = computeContextUsage(DEFAULT_CONTEXT_WINDOW / 2, 0);
    expect(usage.percent).toBe(50);
  });
});
