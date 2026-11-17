import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

// `pxxl setup agent`: everything a coding agent needs to use Pxxl, in one
// command. Installs the CLI globally, writes the Pxxl skill into each coding
// agent on this machine and, given an MCP key, registers Pxxl's MCP server in
// each of them. Safe to run again: every step replaces what it wrote before.

const run = promisify(execFile);

const tty = () => !process.env.NO_COLOR && process.stdout.isTTY;
const paint = (code: number) => (value: string) => (tty() ? `\u001b[${code}m${value}\u001b[0m` : value);
const bold = paint(1);
const dim = paint(2);
const green = paint(32);
const yellow = paint(33);
const cyan = paint(36);
const print = (value = "") => process.stdout.write(`${value}\n`);

export const MCP_SERVER_NAME = "pxxl";

export const setupHelp = `${bold("pxxl setup agent")} – set up Pxxl for your coding agents

  ${cyan("npx -y @pxxlapp/pxxl@latest setup agent")}

Installs the pxxl CLI globally and adds the Pxxl skill to every coding agent found on
this machine: Claude Code, Codex, Cursor and OpenCode. Safe to run again.

Options:
  --agent <names>      Only these agents, comma separated (claude,codex,cursor,opencode)
  --api-key <key>      Also sign the CLI in (same as pxxl login --api-key)
  --mcp-key <key>      Also register Pxxl's MCP server in each agent (or set PXXL_MCP_KEY).
                       Create one at https://pxxl.app/dashboard/mcp (Plus and above)
  --no-global          Don't install the CLI globally
  --dry-run            Show what would change, change nothing

Agent instructions: https://pxxl.app/prompt.md`;

export type AgentId = "claude" | "codex" | "cursor" | "opencode";

export type AgentTarget = {
  id: AgentId;
  name: string;
  /** Folder whose presence means the agent is installed. */
  home: string;
  /** Where the Pxxl skill goes. */
  skillDir: string;
  /** Binary that also counts as installed. */
  binary: string;
};

export function agentTargets(home = homedir()): AgentTarget[] {
  return [
    { id: "claude", name: "Claude Code", home: join(home, ".claude"), skillDir: join(home, ".claude", "skills", "pxxl"), binary: "claude" },
    { id: "codex", name: "Codex", home: join(home, ".codex"), skillDir: join(home, ".codex", "skills", "pxxl"), binary: "codex" },
    { id: "cursor", name: "Cursor", home: join(home, ".cursor"), skillDir: join(home, ".cursor", "skills", "pxxl"), binary: "cursor-agent" },
    { id: "opencode", name: "OpenCode", home: join(home, ".config", "opencode"), skillDir: join(home, ".config", "opencode", "skills", "pxxl"), binary: "opencode" },
  ];
}

async function onPath(binary: string) {
  try {
    await run(process.platform === "win32" ? "where" : "which", [binary]);
    return true;
  } catch {
    return false;
  }
}

/** The agents to set up: the ones asked for, else the ones installed here. */
export async function selectAgents(targets: AgentTarget[], only?: string, isInstalled = onPath): Promise<AgentTarget[]> {
  if (only) {
    const wanted = only.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
    const unknown = wanted.filter((value) => !targets.some((target) => target.id === value));
    if (unknown.length) throw new Error(`Unknown agent: ${unknown.join(", ")}. Use ${targets.map((target) => target.id).join(", ")}.`);
    return targets.filter((target) => wanted.includes(target.id));
  }
  const found: AgentTarget[] = [];
  for (const target of targets) {
    if (existsSync(target.home) || await isInstalled(target.binary)) found.push(target);
  }
  return found;
}

/** Cursor's ~/.cursor/mcp.json with the Pxxl server set (other servers kept). */
export function mergeCursorMcp(existing: string | undefined, url: string, key: string): string {
  const config = existing?.trim() ? JSON.parse(existing) as Record<string, any> : {};
  config.mcpServers = { ...(config.mcpServers || {}), [MCP_SERVER_NAME]: { url, headers: { Authorization: `Bearer ${key}` } } };
  return `${JSON.stringify(config, null, 2)}\n`;
}

/** OpenCode's opencode.json with the Pxxl server set (other settings kept). */
export function mergeOpenCodeMcp(existing: string | undefined, url: string, key: string): string {
  const config = existing?.trim() ? JSON.parse(existing) as Record<string, any> : { $schema: "https://opencode.ai/config.json" };
  config.mcp = { ...(config.mcp || {}), [MCP_SERVER_NAME]: { type: "remote", url, enabled: true, headers: { Authorization: `Bearer ${key}` } } };
  return `${JSON.stringify(config, null, 2)}\n`;
}

/**
 * Codex's config.toml with a [mcp_servers.pxxl] table. Edits the text rather
 * than re-serializing, so the rest of the file (comments, order) is untouched.
 */
export function mergeCodexMcp(existing: string | undefined, url: string, key: string): string {
  const lines = (existing || "").split("\n");
  const kept: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const header = line.trim().match(/^\[\[?([^\]]+)\]\]?$/);
    if (header) {
      const table = header[1]!.trim();
      skipping = table === `mcp_servers.${MCP_SERVER_NAME}` || table.startsWith(`mcp_servers.${MCP_SERVER_NAME}.`);
    }
    if (!skipping) kept.push(line);
  }
  const body = kept.join("\n").replace(/\n+$/, "");
  const block = [
    `[mcp_servers.${MCP_SERVER_NAME}]`,
    `url = ${JSON.stringify(url)}`,
    `http_headers = { Authorization = ${JSON.stringify(`Bearer ${key}`)} }`,
  ].join("\n");
  return `${body ? `${body}\n\n` : ""}${block}\n`;
}

type Step = { agent: string; what: string; ok: boolean; note?: string };

type SetupContext = {
  version: string;
  mcpEndpoint: string;
  /** Saves and validates an API key, as pxxl login does. */
  login: (apiKey: string) => Promise<void>;
  /** Throws when the MCP key is refused. */
  checkMcpKey: (key: string) => Promise<void>;
  /** The skill text shipped with this package. */
  readSkill: () => Promise<string>;
};

function flagValue(args: string[], name: string) {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : undefined;
}

async function readText(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

/** Writes a file that holds a key: owner-only when Pxxl creates it. */
async function writeSecretFile(path: string, content: string) {
  const created = !existsSync(path);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, created ? { mode: 0o600 } : undefined);
  if (created) await chmod(path, 0o600).catch(() => undefined);
}

async function installGlobal(version: string, dryRun: boolean): Promise<Step> {
  const spec = `@pxxlapp/pxxl@${version}`;
  try {
    const { stdout } = await run("pxxl", ["--version"]);
    if (stdout.trim() === version) return { agent: "CLI", what: `pxxl ${version} already installed`, ok: true };
  } catch {
    // not installed yet
  }
  if (dryRun) return { agent: "CLI", what: `would run npm install -g ${spec}`, ok: true };
  try {
    await run(process.platform === "win32" ? "npm.cmd" : "npm", ["install", "-g", spec], { timeout: 180_000 });
    return { agent: "CLI", what: `installed pxxl ${version} globally`, ok: true };
  } catch (error: any) {
    const denied = /EACCES|permission/i.test(String(error?.stderr || error?.message || ""));
    return { agent: "CLI", what: "global install failed", ok: false, note: denied ? `npm can't write its global folder. Run: sudo npm install -g ${spec}` : `Run: npm install -g ${spec}` };
  }
}

async function registerMcp(target: AgentTarget, url: string, key: string, dryRun: boolean): Promise<Step> {
  const label = target.name;
  try {
    if (target.id === "claude") {
      if (!await onPath("claude")) return { agent: label, what: "MCP not registered", ok: false, note: `claude isn't on PATH. Run: claude mcp add --transport http --scope user ${MCP_SERVER_NAME} ${url} --header "Authorization: Bearer <key>"` };
      if (dryRun) return { agent: label, what: "would register MCP (claude mcp add, user scope)", ok: true };
      await run("claude", ["mcp", "remove", "--scope", "user", MCP_SERVER_NAME]).catch(() => undefined);
      await run("claude", ["mcp", "add", "--transport", "http", "--scope", "user", MCP_SERVER_NAME, url, "--header", `Authorization: Bearer ${key}`]);
      return { agent: label, what: "registered MCP (user scope)", ok: true };
    }
    const file = target.id === "cursor" ? join(target.home, "mcp.json")
      : target.id === "codex" ? join(target.home, "config.toml")
      : join(target.home, "opencode.json");
    const merged = target.id === "cursor" ? mergeCursorMcp(await readText(file), url, key)
      : target.id === "codex" ? mergeCodexMcp(await readText(file), url, key)
      : mergeOpenCodeMcp(await readText(file), url, key);
    if (dryRun) return { agent: label, what: `would register MCP in ${file}`, ok: true };
    await writeSecretFile(file, merged);
    return { agent: label, what: `registered MCP in ${file}`, ok: true };
  } catch (error: any) {
    return { agent: label, what: "MCP not registered", ok: false, note: String(error?.message || error) };
  }
}

export async function setupCommand(args: string[], ctx: SetupContext) {
  const sub = args[0] && !args[0].startsWith("-") ? args.shift() : "agent";
  if (sub !== "agent" && sub !== "agents") throw new Error(`Unknown setup target: ${sub}. Run pxxl setup agent.`);
  const dryRun = args.includes("--dry-run");
  const apiKey = flagValue(args, "--api-key");
  const mcpKey = flagValue(args, "--mcp-key") || process.env.PXXL_MCP_KEY;
  const steps: Step[] = [];

  print(bold("Setting up Pxxl for your coding agents") + (dryRun ? dim(" (dry run)") : ""));

  if (!args.includes("--no-global")) steps.push(await installGlobal(ctx.version, dryRun));

  const agents = await selectAgents(agentTargets(), flagValue(args, "--agent"));
  if (!agents.length) {
    print(yellow("No coding agents found (looked for Claude Code, Codex, Cursor and OpenCode)."));
    print(`Install one, or pick them: ${cyan("pxxl setup agent --agent claude,codex")}`);
  }

  const skill = await ctx.readSkill();
  for (const target of agents) {
    const file = join(target.skillDir, "SKILL.md");
    if (dryRun) {
      steps.push({ agent: target.name, what: `would write ${file}`, ok: true });
      continue;
    }
    try {
      await mkdir(target.skillDir, { recursive: true });
      await writeFile(file, skill);
      steps.push({ agent: target.name, what: `skill in ${file}`, ok: true });
    } catch (error: any) {
      steps.push({ agent: target.name, what: "skill not written", ok: false, note: String(error?.message || error) });
    }
  }

  if (mcpKey) {
    try {
      if (!dryRun) await ctx.checkMcpKey(mcpKey);
      for (const target of agents) steps.push(await registerMcp(target, ctx.mcpEndpoint, mcpKey, dryRun));
    } catch (error: any) {
      steps.push({ agent: "MCP", what: "key refused, nothing registered", ok: false, note: String(error?.message || error) });
    }
  }

  let signedIn = false;
  if (apiKey && !dryRun) {
    try {
      await ctx.login(apiKey);
      signedIn = true;
    } catch (error: any) {
      steps.push({ agent: "CLI", what: "sign in failed", ok: false, note: String(error?.message || error) });
    }
  }

  print();
  for (const step of steps) {
    print(`  ${step.ok ? green("✓") : yellow("!")} ${bold(step.agent)} ${step.what}`);
    if (step.note) print(`    ${dim(step.note)}`);
  }
  print();
  if (!mcpKey) print(dim(`MCP: add --mcp-key <key> to register Pxxl's MCP server too (keys at https://pxxl.app/dashboard/mcp).`));
  if (!signedIn) print(`Next: ${cyan("pxxl whoami")}, and if you're not signed in, ${cyan("pxxl login --api-key <key>")} (keys at https://pxxl.app/dashboard/settings).`);
  print(`Agents can follow ${cyan("https://pxxl.app/prompt.md")} from here.`);
  if (steps.some((step) => !step.ok)) process.exitCode = 1;
}
