// Tools that produce or modify a file on disk. Mirrors the Hermes Agent
// toolset naming; `save_*` covers exporter-style tools.
const FILE_WRITING_TOOLS = /^(write_file|create_file|edit_file|append_file|save_\w+)$/;

const PATH_ARG_KEYS = ["path", "file_path", "filepath", "filename", "target_path"];

// The output file a completed tool call produced, or null.
export function extractOutputPath(toolCall) {
  if (!toolCall || toolCall.status !== "done") {
    return null;
  }

  if (!FILE_WRITING_TOOLS.test(toolCall.name ?? "")) {
    return null;
  }

  const args = toolCall.args ?? {};
  for (const key of PATH_ARG_KEYS) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

// Append new output paths from a message's tool calls, deduplicated, oldest
// first.
export function collectOutputs(existing, toolCalls = []) {
  const seen = new Set(existing);
  const next = [...existing];

  for (const toolCall of toolCalls) {
    const path = extractOutputPath(toolCall);
    if (path && !seen.has(path)) {
      seen.add(path);
      next.push(path);
    }
  }

  return next;
}
