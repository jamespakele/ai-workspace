import express from "express";
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";

const app = express();
const PORT = process.env.PORT || 3000;
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || join(homedir(), ".workspace");
const DEFAULT_AGENT = process.env.WORKSPACE_AGENT || "hermes";

app.use(express.json());
app.use(express.static("dist"));

// ── Helpers ──────────────────────────────────────────────────

function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z~]/g, "").replace(/\x1b\][^\x07]*\x07/g, "");
}

function cleanOutput(raw) {
  const stripped = stripAnsi(raw);
  const lines = stripped.split("\n");
  let result = "";
  let blankCount = 0;

  for (const line of lines) {
    if (line.trim() === "") {
      blankCount++;
      if (blankCount <= 2) {
        result += "\n";
      }
    } else {
      blankCount = 0;
      if (result.length > 0) {
        result += "\n";
      }
      result += line;
    }
  }

  return result.trim();
}

function readFileOrEmpty(filePath) {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function whichBin(name) {
  try {
    return execSync(`which ${name}`, { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

// ── Workspace ────────────────────────────────────────────────

function loadWorkspace(projectDir) {
  const soul = readFileOrEmpty(join(WORKSPACE_ROOT, "soul.md"));

  // os.md: project override > global
  let os = "";
  if (projectDir) {
    const projectOs = join(projectDir, ".workspace", "os.md");
    os = existsSync(projectOs)
      ? readFileOrEmpty(projectOs)
      : readFileOrEmpty(join(WORKSPACE_ROOT, "os.md"));
  } else {
    os = readFileOrEmpty(join(WORKSPACE_ROOT, "os.md"));
  }

  // Skills
  const skills = [];
  collectSkills(join(WORKSPACE_ROOT, "skills"), skills);
  if (projectDir) {
    collectSkills(join(projectDir, ".workspace", "skills"), skills);
  }

  return { soul, os, available_skills: skills };
}

function collectSkills(dir, skills) {
  if (!existsSync(dir)) {
    return;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }

    const skillMd = join(dir, entry.name, "SKILL.md");
    if (!existsSync(skillMd)) {
      continue;
    }

    const content = readFileOrEmpty(skillMd);
    let description = "";
    let inFrontmatter = false;

    for (const line of content.split("\n")) {
      if (line.trim() === "---") {
        if (inFrontmatter) {
          break;
        }
        inFrontmatter = true;
        continue;
      }
      if (inFrontmatter && line.startsWith("description:")) {
        description = line.slice("description:".length).trim().replace(/^["']|["']$/g, "");
      }
    }

    const stat = statSync(join(dir, entry.name), { throwIfNoEntry: false });
    skills.push({
      name: entry.name,
      description,
      path: join(dir, entry.name),
      is_symlink: entry.isSymbolicLink(),
    });
  }
}

function buildContextPrefix(ctx) {
  let prefix = "";
  if (ctx.soul) {
    prefix += `<!-- SOUL -->\n${ctx.soul}\n\n`;
  }
  if (ctx.os) {
    prefix += `<!-- OS -->\n${ctx.os}\n\n`;
  }
  return prefix;
}

// ── Agent Harness ────────────────────────────────────────────

const AGENT_CONFIGS = {
  hermes: {
    bins: ["hermes"],
    buildArgs: (text, sessionId, cwd) => {
      const args = ["chat", "-q", "-Q"];
      if (sessionId) {
        args.push("--resume", sessionId);
      }
      args.push(text);
      return args;
    },
  },
  claude: {
    bins: ["claude"],
    buildArgs: (text) => ["-p", "--output-format", "text", text],
  },
  gemini: {
    bins: ["gemini"],
    buildArgs: (text) => [text],
  },
  codex: {
    bins: ["codex"],
    buildArgs: (text) => [text],
  },
  pi: {
    bins: ["pi"],
    buildArgs: (text) => ["run", text],
  },
};

function sendToAgent(agentName, text, sessionId, cwd) {
  const config = AGENT_CONFIGS[agentName];
  if (!config) {
    throw new Error(`Unknown agent: ${agentName}`);
  }

  const binary = config.bins.map(whichBin).find(Boolean);
  if (!binary) {
    throw new Error(`Agent '${agentName}' not found on PATH`);
  }

  const args = config.buildArgs(text, sessionId, cwd);
  const result = spawnSync(binary, args, {
    cwd: cwd || undefined,
    encoding: "utf-8",
    timeout: 300_000, // 5 min timeout
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  const output = cleanOutput(result.stdout || "");
  return {
    session_id: sessionId || "",
    response: output || "(no response)",
    agent: agentName,
  };
}

// ── API Routes ───────────────────────────────────────────────

app.post("/api/send_prompt", (req, res) => {
  const { agent, text, sessionId, cwd } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ error: "Prompt text is empty" });
  }

  try {
    const agentName = agent || DEFAULT_AGENT;
    const workspace = loadWorkspace(cwd);
    const prefix = buildContextPrefix(workspace);
    const fullPrompt = prefix ? `${prefix}${text}` : text;
    const result = sendToAgent(agentName, fullPrompt, sessionId, cwd);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/discover_agents", (_req, res) => {
  const agents = [];

  for (const [name, config] of Object.entries(AGENT_CONFIGS)) {
    const binary = config.bins.map(whichBin).find(Boolean);
    if (binary) {
      let version = "";
      try {
        version = execSync(`${binary} --version`, { encoding: "utf-8" }).trim().split("\n")[0];
      } catch {
        // version detection failed — not critical
      }
      agents.push({ name, binary, version });
    }
  }

  res.json(agents);
});

app.get("/api/workspace", (req, res) => {
  const projectDir = req.query.project_dir || null;
  const workspace = loadWorkspace(projectDir);
  res.json(workspace);
});

// SPA fallback
app.get("*", (_req, res) => {
  res.sendFile(resolve("dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Workspace Desktop running at http://localhost:${PORT}`);
  console.log(`Workspace root: ${WORKSPACE_ROOT}`);
  console.log(`Default agent: ${DEFAULT_AGENT}`);
});
