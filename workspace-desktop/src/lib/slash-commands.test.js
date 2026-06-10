import { describe, expect, it } from "vitest";

import {
  BUILTIN_COMMANDS,
  buildCommandList,
  matchSlashCommands,
} from "./slash-commands";

describe("buildCommandList", () => {
  it("includes built-ins with no skills", () => {
    const commands = buildCommandList([]);
    expect(commands.map((command) => command.name)).toEqual([
      "compact",
      "schedule",
    ]);
  });

  it("appends imported skills", () => {
    const commands = buildCommandList([
      { name: "weekly-report", trigger_phrases: ["weekly report"] },
    ]);
    expect(commands.at(-1)).toMatchObject({
      name: "weekly-report",
      kind: "skill",
    });
  });

  it("skips malformed skills", () => {
    const commands = buildCommandList([{ description: "no name" }, null]);
    expect(commands).toHaveLength(BUILTIN_COMMANDS.length);
  });
});

describe("matchSlashCommands", () => {
  const commands = buildCommandList([{ name: "weekly-report" }]);

  it("returns null when input is not a slash command", () => {
    expect(matchSlashCommands("hello", commands)).toBeNull();
    expect(matchSlashCommands("", commands)).toBeNull();
  });

  it("returns all commands for a bare slash", () => {
    expect(matchSlashCommands("/", commands)).toHaveLength(3);
  });

  it("filters by prefix, case-insensitive", () => {
    const matches = matchSlashCommands("/CO", commands);
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe("compact");
  });

  it("closes the menu once whitespace follows the command", () => {
    expect(matchSlashCommands("/compact now", commands)).toBeNull();
  });

  it("returns empty array when nothing matches", () => {
    expect(matchSlashCommands("/zzz", commands)).toEqual([]);
  });
});
