export const BUILTIN_COMMANDS = [
  {
    name: "compact",
    description: "Summarize the conversation to free up context",
    kind: "builtin",
  },
  {
    name: "schedule",
    description: "Create a scheduled task from a prompt",
    kind: "builtin",
  },
];

// Merge built-ins with imported skills into one command list.
export function buildCommandList(skills = []) {
  const skillCommands = skills
    .filter((skill) => skill?.name)
    .map((skill) => ({
      name: skill.name,
      description: skill.description || skill.trigger_phrases?.join(", ") || "Imported skill",
      kind: "skill",
    }));

  return [...BUILTIN_COMMANDS, ...skillCommands];
}

// `input` is the full composer text. Returns matches when the text is a
// slash-prefix (e.g. "/co"), otherwise null (menu closed).
export function matchSlashCommands(input, commands) {
  if (typeof input !== "string" || !input.startsWith("/")) {
    return null;
  }

  const query = input.slice(1).toLowerCase();
  if (/\s/.test(query)) {
    return null;
  }

  return commands.filter((command) =>
    command.name.toLowerCase().startsWith(query),
  );
}
