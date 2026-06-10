import { describe, expect, it } from "vitest";

import { collectOutputs, extractOutputPath } from "./outputs";

function doneCall(name, args) {
  return { name, args, status: "done" };
}

describe("extractOutputPath", () => {
  it("extracts path from write_file", () => {
    expect(extractOutputPath(doneCall("write_file", { path: "/tmp/report.md" }))).toBe(
      "/tmp/report.md",
    );
  });

  it("supports alternate arg keys", () => {
    expect(
      extractOutputPath(doneCall("create_file", { file_path: "/tmp/a.csv" })),
    ).toBe("/tmp/a.csv");
    expect(
      extractOutputPath(doneCall("save_report", { filename: "out.pdf" })),
    ).toBe("out.pdf");
  });

  it("ignores running tool calls", () => {
    expect(
      extractOutputPath({
        name: "write_file",
        args: { path: "/tmp/x" },
        status: "running",
      }),
    ).toBeNull();
  });

  it("ignores non-writing tools", () => {
    expect(extractOutputPath(doneCall("read_file", { path: "/tmp/x" }))).toBeNull();
    expect(extractOutputPath(doneCall("bash", { command: "ls" }))).toBeNull();
  });

  it("returns null when no path arg exists", () => {
    expect(extractOutputPath(doneCall("write_file", {}))).toBeNull();
    expect(extractOutputPath(null)).toBeNull();
  });
});

describe("collectOutputs", () => {
  it("appends new paths and dedupes", () => {
    const first = collectOutputs([], [
      doneCall("write_file", { path: "/tmp/a.md" }),
      doneCall("write_file", { path: "/tmp/b.md" }),
    ]);
    expect(first).toEqual(["/tmp/a.md", "/tmp/b.md"]);

    const second = collectOutputs(first, [
      doneCall("edit_file", { path: "/tmp/a.md" }),
      doneCall("write_file", { path: "/tmp/c.md" }),
    ]);
    expect(second).toEqual(["/tmp/a.md", "/tmp/b.md", "/tmp/c.md"]);
  });

  it("returns existing list untouched when nothing new", () => {
    const existing = ["/tmp/a.md"];
    expect(collectOutputs(existing, [doneCall("bash", {})])).toEqual(existing);
  });
});
