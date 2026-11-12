import { spawn } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { basename, resolve } from "node:path";
import { readPxxlToml, writeDefaultPxxlFiles, type Pxxl } from "./index.js";

// Vercel-style project commands: link, env pull/add/rm, dev, rollback, cancel,
// rebuild, restart, pause, resume, health, metrics, cache purge, curl, ls, rm,
// project settings, and following a deploy to its URL.

export type PlatformContext = {
  resolveProject: (args: string[]) => Promise<string>;
  promptSelect: <T extends string>(label: string, options: Array<{ label: string; value: T; name?: string; hidden?: boolean }>) => Promise<T>;
  promptConfirm: (label: string, defaultValue: boolean) => Promise<boolean>;
  promptText: (label: string, defaultValue?: string) => Promise<string>;
  interactive: () => boolean;
};

const tty = () => !process.env.NO_COLOR && process.stdout.isTTY;
const paint = (code: number) => (value: string) => (tty() ? `\u001b[${code}m${value}\u001b[0m` : value);
const bold = paint(1);
const dim = paint(2);
const red = paint(31);
const green = paint(32);
const yellow = paint(33);
const cyan = paint(36);
const print = (value = "") => process.stdout.write(`${value}\n`);
const json = (value: unknown) => print(JSON.stringify(value, null, 2));
const record = (value: unknown): Record<string, any> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {});
const list = (value: unknown): any[] => (Array.isArray(value) ? value : []);
const text = (value: unknown) => (value === undefined || value === null ? "" : String(value));

export function flag(args: string[], ...names: string[]): string | undefined {
  for (const name of names) {
    const index = args.indexOf(name);
    if (index >= 0 && args[index + 1] !== undefined && !args[index + 1]!.startsWith("--")) return args[index + 1];
    const inline = args.find((arg) => arg.startsWith(`${name}=`));
    if (inline) return inline.slice(name.length + 1);
  }
  return undefined;
}

const VALUE_FLAGS = new Set(["--project", "--dir", "--port", "--range", "--name", "-X", "--method", "-H", "--header", "-d", "--data", "--command", "--file", "--build-command", "--start-command", "--install-command", "--root", "--branch", "--framework", "--node-version", "--health-path", "--team", "--limit", "--since", "--lines", "-n", "--deployment", "--app", "--set", "--url"]);
export function words(args: string[]): string[] {
  const out: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--") break;
    if (arg.startsWith("-")) {
      if (VALUE_FLAGS.has(arg)) index += 1;
      continue;
    }
    out.push(arg);
  }
  return out;
}

export const statusTone = (status: string) => {
  const value = status.toLowerCase();
  if (/(success|ready|running|active|live|healthy|deployed|completed|online)/.test(value)) return green(status);
  if (/(superseded)/.test(value)) return dim(status);
  if (/(fail|error|crash|unhealthy|cancel|stopped|timeout)/.test(value)) return red(status);
  if (/(build|queue|pending|deploy|start|progress|paused|waiting)/.test(value)) return yellow(status);
  return status;
};
const ago = (value: unknown) => {
  const time = new Date(text(value)).getTime();
  if (!Number.isFinite(time)) return "-";
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.round(seconds / 60)}m ago` : seconds < 86400 ? `${Math.round(seconds / 3600)}h ago` : `${Math.round(seconds / 86400)}d ago`;
};
const stripAnsi = (value: string) => value.replace(/\u001b\[[0-9;]*m/g, "");
function table(rows: string[][]) {
  const widths = rows[0]!.map((_, column) => Math.max(...rows.map((row) => stripAnsi(row[column] || "").length)));
  for (const row of rows) print(row.map((cell, column) => cell + " ".repeat(Math.max(0, widths[column]! - stripAnsi(cell).length))).join("  ").trimEnd());
}
function kv(rows: Array<[string, unknown]>) {
  const width = Math.max(...rows.map(([name]) => name.length));
  for (const [name, value] of rows) if (text(value) !== "") print(`  ${dim(name.padEnd(width))}  ${text(value)}`);
}
const done = (message: string) => print(`${green("✓")} ${message}`);

/** The project object out of the Gateway's several response shapes. */
export const projectOf = (value: unknown) => { const root = record(value); return record(root.project || root.data || root); };
export const deploymentsOf = (value: unknown) => { const root = record(value); return list(root.deployments || record(root.data).deployments || root.data).map(record); };
export const deploymentFrom = (value: unknown) => { const root = record(value); return record(root.deployment || root.data || root); };
export const deploymentStatus = (deployment: Record<string, any>) => text(deployment.status || deployment.state || deployment.deploymentStatus || "unknown");
export function projectUrl(project: Record<string, any>): string {
  const candidates = [project.url, project.liveUrl, project.domain, project.domainName, project.customDomain, list(project.domains)[0]?.domain, list(project.domains)[0]];
  const host = text(candidates.find((value) => typeof value === "string" && value));
  return host ? (host.startsWith("http") ? host : `https://${host}`) : "";
}
const terminal = (status: string) => /(success|ready|deployed|live|completed|running|fail|error|cancel|timeout|crash|stopped)/i.test(status);
const succeeded = (status: string) => /(success|ready|deployed|live|completed|running)/i.test(status);

/** Stream a deployment's build logs and wait until it finishes. Returns the final deployment. */
export async function followDeployment(pxxl: Pxxl, deploymentId: string, options: { quiet?: boolean; timeoutMs?: number } = {}) {
  const seen = new Set<string>();
  const started = Date.now();
  let lastStatus = "";
  while (true) {
    const deployment = deploymentFrom(await pxxl.getDeployment(deploymentId));
    const status = deploymentStatus(deployment);
    if (!options.quiet) {
      try {
        for (const line of logLines(await pxxl.deploymentLogs(deploymentId, { build: true }))) {
          const key = `${line.timestamp}|${line.content}`;
          if (seen.has(key)) continue;
          seen.add(key);
          print(`${dim(line.time)} ${line.content}`);
        }
      } catch { /* logs may not exist yet */ }
      if (status !== lastStatus) print(dim(`── ${statusTone(status)}`));
    }
    lastStatus = status;
    if (terminal(status) && !/(build|queue|pending|progress)/i.test(status)) return { deployment, status, ok: succeeded(status) };
    if (Date.now() - started > (options.timeoutMs || 30 * 60_000)) return { deployment, status, ok: false, timedOut: true };
    await new Promise((resolveTimer) => setTimeout(resolveTimer, 2500));
  }
}

export function logLines(value: unknown): Array<{ timestamp: string; time: string; content: string }> {
  const root = record(value);
  const rows = list(root.logs || root.data || record(root.data).logs || root.lines || value);
  return rows.map((row) => {
    if (typeof row === "string") return { timestamp: "", time: "", content: row };
    const item = record(row);
    const timestamp = text(item.timestamp || item.time || item.createdAt || item.created_at);
    const date = new Date(timestamp);
    return { timestamp, time: Number.isFinite(date.getTime()) ? date.toLocaleTimeString([], { hour12: false }) : "", content: text(item.content || item.message || item.log || item.line).replace(/\s+$/, "") };
  }).filter((line) => line.content);
}

async function exists(path: string) {
  try { await access(path); return true; } catch { return false; }
}

// ---- link ----

export async function linkCommand(pxxl: Pxxl, ctx: PlatformContext, args: string[]) {
  const cwd = resolve(flag(args, "--dir") || ".");
  const config = await readPxxlToml(cwd);
  let projectId = words(args)[0] || flag(args, "--project");
  if (!projectId) {
    const listed = record(await pxxl.listProjects({ page: 1, limit: 50 }));
    const projects = list(listed.projects || record(listed.data).projects || listed.data).map(record);
    const folder = basename(cwd).toLowerCase();
    const guess = projects.find((project) => text(project.name).toLowerCase() === folder);
    if (guess && (args.includes("--yes") || !ctx.interactive() || await ctx.promptConfirm(`Link to ${bold(text(guess.name))}?`, true))) projectId = text(guess.id);
    else {
      // Newest first; a name typed at the prompt also works, so the list stays short.
      if (projects.length > 20) print(dim(`Showing your 20 newest projects of ${projects.length}. Type a number, or a project name.`));
      projectId = await ctx.promptSelect("Link this folder to", projects.map((project) => ({ label: `${text(project.name)} ${dim(text(project.status))}`, value: text(project.id), name: text(project.name) })).slice(0, 20).concat(projects.slice(20).map((project) => ({ label: "", value: text(project.id), name: text(project.name), hidden: true }))));
    }
  }
  const project = projectOf(await pxxl.getProject(projectId));
  config.projectId = text(project.id || projectId);
  config.name = config.name || text(project.name) || undefined;
  const url = projectUrl(project);
  if (url) config.projectUrl = url;
  await writeDefaultPxxlFiles(cwd, config);
  if (args.includes("--json")) return json({ linked: config.projectId, name: project.name, url });
  done(`Linked ${bold(text(project.name || projectId))} to ${cwd}`);
  if (url) print(`  ${cyan(url)}`);
  print(dim("  Saved in pxxl.toml. Commands in this folder now use this project."));
}

export async function unlinkCommand(args: string[]) {
  const cwd = resolve(flag(args, "--dir") || ".");
  const config = await readPxxlToml(cwd);
  if (!config.projectId) return print("This folder is not linked to a Pxxl project.");
  const previous = config.projectId;
  delete config.projectId;
  delete config.deploymentId;
  delete config.deploymentUrl;
  await writeDefaultPxxlFiles(cwd, config);
  done(`Unlinked ${previous}`);
}

// ---- env add / rm / get / pull ----

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

/** Every variable with its value: plain values from the list, secrets revealed one by one. */
export async function pullEnv(pxxl: Pxxl, projectId: string): Promise<Record<string, string>> {
  const root = record(await pxxl.listProjectEnv(projectId));
  const rows = list(root.envs || root.env || root.variables || root.data || record(root.data).envs).map(record);
  const values: Record<string, string> = {};
  await Promise.all(rows.map(async (row) => {
    const key = text(row.key || row.name);
    if (!key) return;
    const value = row.value;
    const masked = row.isSecret || row.secret || row.masked || typeof value !== "string" || /^\*+$|^•+$/.test(text(value));
    if (!masked) { values[key] = text(value); return; }
    const revealed = record(await pxxl.revealProjectEnv(projectId, key));
    values[key] = text(revealed.value ?? record(revealed.env).value ?? record(revealed.data).value);
  }));
  return values;
}

const dotenvLine = (key: string, value: string) => `${key}=${/^[\w@%+=:,./-]*$/.test(value) ? value : JSON.stringify(value)}`;

export async function envCommand(pxxl: Pxxl, ctx: PlatformContext, sub: string, args: string[]) {
  const asJSON = args.includes("--json");
  const projectId = await ctx.resolveProject(args);
  const [key, inlineValue] = words(args);
  if (sub === "add" || sub === "set") {
    if (!key) throw new Error("Usage: pxxl env add KEY [value]   (or pipe the value: echo $SECRET | pxxl env add KEY)");
    const value = inlineValue ?? (await readStdin()) ?? "";
    const finalValue = value || (ctx.interactive() ? await ctx.promptText(`Value for ${key}`) : "");
    if (!finalValue) throw new Error(`No value for ${key}. Pass it as an argument or on stdin.`);
    const secret = !args.includes("--plain");
    let result: unknown;
    try {
      result = await pxxl.addProjectEnv(projectId, { key, value: finalValue, secret });
    } catch (error) {
      if (!/exist/i.test(error instanceof Error ? error.message : "")) throw error;
      result = await pxxl.updateProjectEnv(projectId, { key, value: finalValue, secret });
    }
    if (asJSON) return json(result);
    done(`${key} saved (stored encrypted). Redeploy to use it: ${cyan("pxxl redeploy")}`);
    return;
  }
  if (sub === "rm" || sub === "remove" || sub === "delete") {
    if (!key) throw new Error("Usage: pxxl env rm KEY");
    if (!args.includes("--yes") && ctx.interactive() && !(await ctx.promptConfirm(`Remove ${key}?`, false))) return print("Kept.");
    const result = await pxxl.deleteProjectEnv(projectId, key);
    return asJSON ? json(result) : done(`Removed ${key}`);
  }
  if (sub === "get") {
    if (!key) throw new Error("Usage: pxxl env get KEY");
    const revealed = record(await pxxl.revealProjectEnv(projectId, key));
    const value = text(revealed.value ?? record(revealed.env).value ?? record(revealed.data).value);
    return asJSON ? json({ key, value }) : print(value);
  }
  if (sub === "pull") {
    const file = resolve(key || flag(args, "--file") || ".env.local");
    const values = await pullEnv(pxxl, projectId);
    const keys = Object.keys(values).sort();
    if (asJSON) return json(values);
    if (await exists(file) && !args.includes("--yes") && ctx.interactive() && !(await ctx.promptConfirm(`Overwrite ${basename(file)}?`, true))) return print("Kept your file.");
    const body = `# Pulled from Pxxl project ${projectId} on ${new Date().toISOString()}\n# Do not commit this file.\n${keys.map((name) => dotenvLine(name, values[name]!)).join("\n")}\n`;
    await writeFile(file, body, { mode: 0o600 });
    done(`Wrote ${keys.length} variable${keys.length === 1 ? "" : "s"} to ${basename(file)}`);
    if (!(await readFile(resolve(".gitignore"), "utf8").catch(() => "")).includes(basename(file))) print(yellow(`  Add ${basename(file)} to .gitignore so it is never committed.`));
    return;
  }
  throw new Error(`Unknown env command: ${sub}`);
}

// ---- dev ----

async function detectDevCommand(cwd: string): Promise<string> {
  const pkg = JSON.parse(await readFile(resolve(cwd, "package.json"), "utf8").catch(() => "{}")) as { scripts?: Record<string, string> };
  const pm = (await exists(resolve(cwd, "pnpm-lock.yaml"))) ? "pnpm" : (await exists(resolve(cwd, "yarn.lock"))) ? "yarn" : (await exists(resolve(cwd, "bun.lockb"))) || (await exists(resolve(cwd, "bun.lock"))) ? "bun" : "npm";
  for (const script of ["dev", "start:dev", "develop", "start"]) if (pkg.scripts?.[script]) return `${pm} run ${script}`;
  if (await exists(resolve(cwd, "manage.py"))) return "python manage.py runserver";
  if (await exists(resolve(cwd, "main.go"))) return "go run .";
  throw new Error("No dev script found. Add a \"dev\" script to package.json, or run: pxxl dev -- <command>");
}

const waitForPort = (port: number, timeoutMs: number) => new Promise<boolean>((resolvePort) => {
  const until = Date.now() + timeoutMs;
  const attempt = () => {
    const socket = connect(port, "127.0.0.1");
    socket.once("connect", () => { socket.destroy(); resolvePort(true); });
    socket.once("error", () => { socket.destroy(); if (Date.now() > until) resolvePort(false); else setTimeout(attempt, 500); });
  };
  attempt();
});

export async function devCommand(pxxl: Pxxl, ctx: PlatformContext, args: string[]) {
  const cwd = resolve(flag(args, "--dir") || ".");
  const separator = args.indexOf("--");
  const command = separator >= 0 ? args.slice(separator + 1).join(" ") : flag(args, "--command") || (await detectDevCommand(cwd));
  const port = Number(flag(args, "--port") || 3000);
  const env: Record<string, string> = {};
  let projectName = "";
  if (!args.includes("--no-env")) {
    const config = await readPxxlToml(cwd);
    const projectId = flag(args, "--project") || config.projectId || (ctx.interactive() ? await ctx.resolveProject(args) : "");
    if (projectId) {
      Object.assign(env, await pullEnv(pxxl, projectId));
      projectName = text(projectOf(await pxxl.getProject(projectId)).name) || projectId;
    }
  }
  // The shell wins over Pxxl, so you can override one value for a run.
  const merged: NodeJS.ProcessEnv = { ...env, ...process.env, PORT: process.env.PORT || String(port), PXXL_DEV: "1" };
  print(`${bold("pxxl dev")}  ${dim(command)}`);
  kv([["Project", projectName || dim("not linked (pxxl link)")], ["Env", projectName ? `${Object.keys(env).length} variables from Pxxl` : dim("local only")], ["Port", String(port)]]);
  print();
  const child = spawn(command, { cwd, env: merged, stdio: "inherit", shell: true });
  let tunnel: { close(): void } | undefined;
  const stop = () => { tunnel?.close(); if (!child.killed) child.kill("SIGINT"); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  if (args.includes("--tunnel") || args.includes("--share")) {
    void (async () => {
      if (!(await waitForPort(port, 120_000))) return print(yellow(`\nNothing is listening on port ${port}; not sharing it. Pass --port if your app uses another.`));
      const { connection } = await pxxl.tunnels.expose(port, { name: `${(projectName || basename(cwd)).toLowerCase().replace(/[^a-z0-9-]+/g, "-")}-dev` });
      tunnel = connection;
      connection.on("online", (hello) => print(`\n${green("✓")} Shared at ${cyan(hello.publicUrl)}\n`));
      connection.on("error", (error) => print(red(`\nTunnel stopped: ${error.message}`)));
    })().catch((error) => print(red(`\nCould not share the dev server: ${error.message}`)));
  }
  const code = await new Promise<number>((resolveExit) => child.on("exit", (exitCode) => resolveExit(exitCode ?? 0)));
  tunnel?.close();
  process.exitCode = code;
}

// ---- deployments: ls, rollback, cancel, rebuild, errors ----

async function projectDeployments(pxxl: Pxxl, projectId: string, limit = 20) {
  return deploymentsOf(await pxxl.listDeployments({ projectId, page: 1, limit }));
}

export async function lsCommand(pxxl: Pxxl, ctx: PlatformContext, args: string[]) {
  const projectId = await ctx.resolveProject(args);
  const deployments = await projectDeployments(pxxl, projectId, Number(flag(args, "--limit")) || 20);
  if (args.includes("--json")) return json(deployments);
  if (!deployments.length) return print(`No deployments yet. Run ${cyan("pxxl deploy")}.`);
  table([["ID", "STATUS", "AGE", "COMMIT", "SOURCE"].map(dim), ...deployments.map((item) => [text(item.id), statusTone(deploymentStatus(item)), ago(item.createdAt || item.created_at), text(item.commitMessage || item.commit_message || item.commitSha || "").split("\n")[0]!.slice(0, 48), text(item.source || item.trigger || item.branch || "")])]);
}

export async function rollbackCommand(pxxl: Pxxl, ctx: PlatformContext, args: string[]) {
  let deploymentId = words(args)[0];
  if (!deploymentId) {
    const projectId = await ctx.resolveProject(args);
    // A superseded or stopped deployment is still a rollback target if its build is kept.
    const all = await projectDeployments(pxxl, projectId, 30);
    const live = all.find((item) => /^(deployed|running|live|active)$/i.test(deploymentStatus(item)));
    const good = all.filter((item) => item.id !== live?.id && (item.canRollback === true || (item.canRollback === undefined && /complete|success/i.test(text(item.buildStatus)))) && !item.artifactExpired);
    if (!good.length) throw new Error("There is no earlier deployment to roll back to.");
    const target = ctx.interactive() && !args.includes("--yes")
      ? await ctx.promptSelect("Roll back to", good.slice(0, 10).map((item) => ({ label: `${text(item.id)}  ${dim(ago(item.createdAt || item.created_at))}  ${text(item.commitMessage || "").split("\n")[0]!.slice(0, 40)}`, value: text(item.id) })))
      : text(good[0]!.id);
    deploymentId = target;
  }
  if (!args.includes("--yes") && ctx.interactive() && !(await ctx.promptConfirm(`Make ${deploymentId} live again?`, true))) return print("Cancelled.");
  const result = await pxxl.rollbackDeployment(deploymentId);
  if (args.includes("--json")) return json(result);
  done(text(record(result).message) || `Rolling back to ${deploymentId}`);
  const next = text(record(result).deploymentId || record(record(result).deployment).id);
  if (next && !args.includes("--no-wait")) await reportDeployment(pxxl, next, args);
}

async function latestDeployment(pxxl: Pxxl, ctx: PlatformContext, args: string[], match: (status: string) => boolean, label: string) {
  const id = words(args)[0];
  if (id) return id;
  const projectId = await ctx.resolveProject(args);
  const found = (await projectDeployments(pxxl, projectId)).find((item) => match(deploymentStatus(item)));
  if (!found) throw new Error(`No ${label} deployment found for this project.`);
  return text(found.id);
}

export async function cancelCommand(pxxl: Pxxl, ctx: PlatformContext, args: string[]) {
  const id = await latestDeployment(pxxl, ctx, args, (status) => /(build|queue|pending|progress|deploying)/i.test(status), "running");
  const result = await pxxl.cancelDeployment(id);
  return args.includes("--json") ? json(result) : done(text(record(result).message) || `Cancelled ${id}`);
}

export async function rebuildCommand(pxxl: Pxxl, ctx: PlatformContext, args: string[]) {
  const id = await latestDeployment(pxxl, ctx, args, () => true, "");
  const startedAt = Date.now();
  const result = await pxxl.rebuildDeployment(id);
  if (args.includes("--json")) return json(result);
  done(text(record(result).message) || `Rebuilding ${id}`);
  const next = text(record(result).deploymentId || record(record(result).deployment).id);
  if (next && !args.includes("--no-wait")) await reportDeployment(pxxl, next, args);
  else if (!next) await followQueued(pxxl, text(deploymentFrom(await pxxl.getDeployment(id)).projectId), startedAt, args);
}

export async function errorsCommand(pxxl: Pxxl, ctx: PlatformContext, args: string[]) {
  const id = await latestDeployment(pxxl, ctx, args, (status) => /(fail|error)/i.test(status), "failed");
  const result = record(await pxxl.deploymentBuildErrors(id));
  if (args.includes("--json")) return json(result);
  const groups = list(result.groups || result.errors || result.items).map(record);
  if (!groups.length) {
    // Not a compiler-style error (say, no build server or a crash at start): show how the log ended.
    const status = deploymentStatus(deploymentFrom(await pxxl.getDeployment(id)));
    const tail = logLines(await pxxl.deploymentLogs(id, { build: true }).catch(() => ({}))).slice(-12);
    if (!/(fail|error)/i.test(status) || !tail.length) return done(`No build errors found in ${id}`);
    print(`${red("✗")} ${bold(id)} ${statusTone(status)}. No known error pattern; the build log ended with:\n`);
    for (const line of tail) print(`  ${dim(line.time)} ${line.content}`);
    return;
  }
  // Pxxl's own wrap-up lines ("Your build command failed…") repeat the cause; keep the real errors.
  const generic = /^(oh no, your deployment failed|\[failure_class=|build failed after|your build command failed)/i;
  const real = groups.filter((group) => !generic.test(text(group.message || group.pattern || group.title || group.line).trim()));
  const summary = groups.find((group) => /^build failed after/i.test(text(group.message || group.line)));
  print(`${bold(`Build errors in ${id}`)}${summary ? dim(`  ·  ${text(summary.message || summary.line).replace(/^Build /, "")}`) : ""}`);
  for (const group of real.length ? real : groups) {
    print(`\n${red("✗")} ${text(group.message || group.pattern || group.title || group.line)}${group.count ? dim(`  ×${group.count}`) : ""}`);
    for (const line of list(group.lines || group.examples).slice(0, 3)) print(dim(`    ${text(record(line).content || line).slice(0, 200)}`));
    if (group.hint || group.suggestion) print(`  ${cyan("→")} ${text(group.hint || group.suggestion)}`);
  }
}

const inProgress = (status: string) => /(build|queue|pending|progress|deploying|starting)/i.test(status);

/**
 * `pxxl watch`: follow the deployment that is building now, or wait for the
 * next one (a git push, a dashboard redeploy) and follow it to the end.
 */
export async function watchCommand(pxxl: Pxxl, ctx: PlatformContext, args: string[]) {
  const projectId = await ctx.resolveProject(args);
  const seen = new Set<string>();
  const once = args.includes("--once");
  const current = (await projectDeployments(pxxl, projectId, 5))[0];
  if (current) seen.add(text(current.id));
  if (current && inProgress(deploymentStatus(current))) {
    await reportDeployment(pxxl, text(current.id), args);
    if (once) return;
  } else {
    print(`${dim("Latest:")} ${current ? `${text(current.id)} ${statusTone(deploymentStatus(current))} ${dim(ago(current.createdAt))}` : "no deployments yet"}`);
  }
  print(dim("Waiting for the next deployment (push to git, or run pxxl deploy / redeploy). Ctrl+C to stop."));
  while (true) {
    await new Promise((resolveTimer) => setTimeout(resolveTimer, 3000));
    const fresh = (await projectDeployments(pxxl, projectId, 5).catch(() => [])).find((item) => !seen.has(text(item.id)));
    if (!fresh) continue;
    seen.add(text(fresh.id));
    print(`\n${cyan("●")} New deployment ${bold(text(fresh.id))}${fresh.commitMessage ? dim(`  ${text(fresh.commitMessage).split("\n")[0]!.slice(0, 60)}`) : ""}`);
    await reportDeployment(pxxl, text(fresh.id), args);
    process.exitCode = 0;
    if (once) return;
  }
}

/** `pxxl logs --build` / `--deployment <id>`: a deployment's build log, followed live with -f. */
export async function deploymentLogsCommand(pxxl: Pxxl, ctx: PlatformContext, args: string[], deploymentId?: string) {
  let id = deploymentId;
  if (!id) {
    const latest = (await projectDeployments(pxxl, await ctx.resolveProject(args), 1))[0];
    if (!latest) throw new Error("This project has no deployments yet.");
    id = text(latest.id);
  }
  const follow = args.includes("-f") || args.includes("--follow");
  const deployment = deploymentFrom(await pxxl.getDeployment(id));
  if (follow && inProgress(deploymentStatus(deployment))) return reportDeployment(pxxl, id, args);
  const lines = logLines(await pxxl.deploymentLogs(id, { build: true }));
  if (args.includes("--json")) return json(lines);
  print(`${bold(id)}  ${statusTone(deploymentStatus(deployment))}  ${dim(ago(deployment.createdAt))}`);
  for (const line of lines) print(`${dim(line.time)} ${line.content}`);
  if (!lines.length) print(dim("No build output yet."));
  if (follow) print(dim(`\nThis deployment already finished. Run ${cyan("pxxl watch")} to follow the next one.`));
}

/** Follow the deployment an action just queued when the API does not return its id. */
async function followQueued(pxxl: Pxxl, projectId: string, startedAt: number, args: string[]) {
  if (args.includes("--no-wait")) return;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const newest = (await projectDeployments(pxxl, projectId, 5)).find((item) => new Date(text(item.createdAt)).getTime() >= startedAt - 5000);
    if (newest) return reportDeployment(pxxl, text(newest.id), args);
    await new Promise((resolveTimer) => setTimeout(resolveTimer, 1500));
  }
}

/** Follow a deployment (unless --no-wait) and print how it ended. */
export async function reportDeployment(pxxl: Pxxl, deploymentId: string, args: string[], fallbackUrl = "") {
  print(dim(`\nFollowing ${deploymentId} (Ctrl+C stops watching; the deployment keeps going)\n`));
  const outcome = await followDeployment(pxxl, deploymentId, { quiet: args.includes("--quiet") });
  const url = projectUrl(outcome.deployment) || fallbackUrl;
  print();
  if (outcome.ok) {
    done(`${bold("Live")}${url ? `  ${cyan(url)}` : ""}`);
  } else {
    print(`${red("✗")} Deployment ${statusTone(outcome.status)}${outcome.timedOut ? " (stopped watching after 30 minutes)" : ""}`);
    print(dim(`  See what failed: pxxl errors ${deploymentId}`));
    process.exitCode = 1;
  }
}

// ---- project lifecycle and status ----

export async function lifecycleCommand(pxxl: Pxxl, ctx: PlatformContext, action: "restart" | "pause" | "resume", args: string[]) {
  const projectId = await ctx.resolveProject(args);
  const startedAt = Date.now();
  let result: unknown;
  try {
    result = action === "pause" ? await pxxl.pauseProject(projectId) : await pxxl.restartProject(projectId);
  } catch (error) {
    // Restart resumes a paused app; a running one is restarted by redeploying its current source.
    if (action !== "restart" || !/already active/i.test(error instanceof Error ? error.message : "")) throw error;
    print(dim("Running app: restarting by redeploying the current version."));
    result = await pxxl.redeployProject(projectId);
    const next = text(record(result).deploymentId || record(record(result).deployment).id);
    if (args.includes("--json")) return json(result);
    if (next && !args.includes("--no-wait")) return reportDeployment(pxxl, next, args);
    done(text(record(result).message) || "Restarting");
    return followQueued(pxxl, projectId, startedAt, args);
  }
  if (args.includes("--json")) return json(result);
  done(text(record(result).message) || { restart: "Restarting", pause: "Paused", resume: "Resuming" }[action]);
  if (action !== "pause") await followQueued(pxxl, projectId, startedAt, args);
}

export async function healthCommand(pxxl: Pxxl, ctx: PlatformContext, args: string[]) {
  const projectId = await ctx.resolveProject(args);
  const [project, status, deployments] = await Promise.all([
    pxxl.getProject(projectId).then(projectOf),
    pxxl.projectLiveStatus(projectId).catch((error: Error) => ({ error: error.message })),
    projectDeployments(pxxl, projectId, 5).catch(() => []),
  ]);
  if (args.includes("--json")) return json({ project, status, deployments });
  const root = record(record(status).data || status);
  // { main: { data: { status, started_at, server_ip, … } }, errors: {…} }
  const services = Object.entries(root).filter(([name]) => name !== "errors").map(([name, value]) => [name, record(record(value).data || value)] as const).filter(([, value]) => Object.keys(value).length);
  const errors = Object.entries(record(root.errors)).map(([name, value]) => `${name}: ${text(value)}`);
  const latest = deployments[0];
  const live = deployments.find((item) => succeeded(deploymentStatus(item)));
  const listed = list(record(await pxxl.listProjects({ page: 1, limit: 100 }).catch(() => ({}))).projects).map(record).find((item) => item.id === projectId);
  const paused = /paused/i.test(text(project.status || listed?.status));
  const state = paused ? "paused" : services.length ? text(services[0]![1].status || services[0]![1].state || "running") : latest ? (live ? "not running" : deploymentStatus(latest)) : "never deployed";
  print(`${bold(text(project.name || projectId))}  ${statusTone(state)}`);
  kv([
    ["URL", projectUrl(project) || text(latest?.domain && `https://${latest.domain}`)],
    ["Framework", text(project.framework || project.language)],
    ["Start", text(project.startCommand)],
    ["Health check", project.healthCheckPath ? `${text(project.healthCheckMethod || "GET")} ${text(project.healthCheckPath)}` : text(project.healthCheckMode)],
    ["Last deploy", latest ? `${statusTone(deploymentStatus(latest))} ${ago(latest.createdAt)}  ${dim(text(latest.id))}` : "-"],
    ["Live deploy", live ? `${text(live.id)}  ${ago(live.createdAt)}` : "none"],
  ]);
  for (const [name, service] of services) {
    print(`\n  ${bold(name)}  ${statusTone(text(service.status || service.state || ""))}`);
    kv([
      ["Started", service.started_at ? ago(service.started_at) : ""],
      ["Container", text(service.container_id).slice(0, 12)],
      ["Server", text(service.server_ip || service.server)],
    ]);
    const recent = list(service.last_logs).slice(-3).map((line) => text(record(line).content || record(line).message || line)).filter(Boolean);
    if (recent.length) { print(dim("    Recent output")); for (const line of recent) print(dim(`      ${line.slice(0, 160)}`)); }
  }
  if (errors.length && !services.length) print(dim(`\n  Runtime: ${errors.join("; ").replace(/live status fetch failed: infra API returned 404/, "no running container")}`));
  if (latest && !succeeded(deploymentStatus(latest))) print(dim(`  See why the last deploy failed: pxxl errors ${text(latest.id)}`));
}

export async function metricsCommand(pxxl: Pxxl, ctx: PlatformContext, args: string[]) {
  const projectId = await ctx.resolveProject(args);
  const result = record(await pxxl.projectMetrics(projectId, { range: flag(args, "--range") }));
  if (args.includes("--json")) return json(result);
  const data = record(result.data || result.metrics || result);
  const snapshots = list(data.snapshots || data.points || data.series).map(record).filter((point) => Object.keys(point).length);
  print(`${bold("Metrics")}${dim(`  every ${text(data.interval || "30s")}${flag(args, "--range") ? ` · last ${flag(args, "--range")}` : ""}`)}`);
  if (!snapshots.length) return print(dim("  No samples yet. Metrics appear once the app has been running for a minute."));
  const latest = snapshots[snapshots.length - 1]!;
  const cpu = Number(latest.cpu_percent_of_allocation ?? latest.cpu_percent ?? 0);
  const mem = Number(latest.memory_percent ?? 0);
  const bar = (percent: number) => { const filled = Math.max(0, Math.min(20, Math.round(percent / 5))); return `${"█".repeat(filled)}${dim("░".repeat(20 - filled))}`; };
  const memLimit = Number(latest.memory_limit_bytes ?? 0);
  kv([
    ["CPU", `${bar(cpu)} ${cpu.toFixed(1)}% of allocation`],
    ["Memory", `${bar(mem)} ${text(latest.memory_human) || `${Math.round(Number(latest.memory_bytes ?? 0) / 1048576)} MB`}${memLimit ? ` of ${Math.round(memLimit / 1048576)} MB` : ""} (${mem.toFixed(0)}%)`],
    ["Processes", text(latest.pids)],
    ["Sampled", ago(latest.timestamp)],
  ]);
  if (snapshots.length > 1) {
    const cpus = snapshots.map((point) => Number(point.cpu_percent_of_allocation ?? point.cpu_percent ?? 0));
    const mems = snapshots.map((point) => Number(point.memory_percent ?? 0));
    const spark = (values: number[]) => values.slice(-30).map((value) => "▁▂▃▄▅▆▇█"[Math.min(7, Math.floor((value / Math.max(1, ...values)) * 7.99))]).join("");
    print(dim(`\n  ${snapshots.length} samples`));
    kv([["CPU trend", `${spark(cpus)}  peak ${Math.max(...cpus).toFixed(1)}%`], ["Memory trend", `${spark(mems)}  peak ${Math.max(...mems).toFixed(0)}%`]]);
  }
}

export async function cacheCommand(pxxl: Pxxl, ctx: PlatformContext, args: string[]) {
  if (words(args)[0] !== "purge") return print(`Usage: ${cyan("pxxl cache purge")} [--project <id>] [--wait]`);
  const projectId = await ctx.resolveProject(args);
  const purge = record(await pxxl.purgeProjectCache(projectId, { id: `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` }));
  const purgeId = text(purge.id || record(purge.purge).id);
  if (args.includes("--json") && !args.includes("--wait")) return json(purge);
  done(`Cache purge started${purgeId ? ` (${purgeId})` : ""}`);
  if (!args.includes("--wait") || !purgeId) return;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const status = record(await pxxl.projectCachePurge(projectId, purgeId));
    const state = text(status.status || record(status.purge).status);
    if (/(done|complete|success|failed|error)/i.test(state)) return print(`  ${statusTone(state)}`);
    await new Promise((resolveTimer) => setTimeout(resolveTimer, 2000));
  }
  print(yellow("  Still running; check again later."));
}

export async function curlCommand(pxxl: Pxxl, ctx: PlatformContext, args: string[]) {
  const config = await readPxxlToml(resolve(flag(args, "--dir") || "."));
  let base = flag(args, "--url") || config.projectUrl || "";
  if (!base) base = projectUrl(projectOf(await pxxl.getProject(await ctx.resolveProject(args))));
  if (!base) throw new Error("This project has no URL yet. Deploy it first.");
  const path = words(args)[0] || "/";
  const url = /^https?:\/\//.test(path) ? path : `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers();
  args.forEach((arg, index) => { if ((arg === "-H" || arg === "--header") && args[index + 1]?.includes(":")) { const [name, ...rest] = args[index + 1]!.split(":"); headers.append(name!.trim(), rest.join(":").trim()); } });
  const body = flag(args, "-d", "--data");
  const method = flag(args, "-X", "--method") || (body ? "POST" : "GET");
  if (body && !headers.has("content-type")) headers.set("content-type", /^\s*[{[]/.test(body) ? "application/json" : "application/x-www-form-urlencoded");
  const started = Date.now();
  const response = await fetch(url, { method, headers, body, redirect: "manual" });
  const elapsed = Date.now() - started;
  const payload = await response.text();
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, name) => { responseHeaders[name] = value; });
  if (args.includes("--json")) return json({ url, status: response.status, ms: elapsed, headers: responseHeaders, body: payload });
  print(`${statusTone(`${response.status} ${response.statusText}`)}  ${method} ${url}  ${dim(`${elapsed}ms`)}`);
  if (args.includes("-i") || args.includes("--include")) for (const [name, value] of Object.entries(responseHeaders)) print(dim(`${name}: ${value}`));
  print();
  try { return print(JSON.stringify(JSON.parse(payload), null, 2)); } catch { /* not JSON */ }
  if (/text\/html/i.test(responseHeaders["content-type"] || "") && !args.includes("--full")) {
    const title = payload.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    const heading = payload.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
    const body = payload.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    print(`${bold("HTML")}  ${title || ""}${heading && heading !== title ? dim(`  ·  ${heading}`) : ""}`);
    print(dim(`${body.slice(0, 300)}${body.length > 300 ? "…" : ""}`));
    return print(dim(`\n${payload.length} bytes · --full for the raw HTML`));
  }
  print(payload.length > 4000 && !args.includes("--full") ? `${payload.slice(0, 4000)}\n${dim(`… ${payload.length - 4000} more bytes (--full)`)}` : payload);
}

export async function removeCommand(pxxl: Pxxl, ctx: PlatformContext, args: string[]) {
  const projectId = await ctx.resolveProject(args);
  const project = projectOf(await pxxl.getProject(projectId));
  const name = text(project.name || projectId);
  if (!args.includes("--yes")) {
    if (!ctx.interactive()) throw new Error(`Deleting ${name} cannot be undone. Pass --yes to confirm.`);
    const typed = await ctx.promptText(`Type ${bold(name)} to delete it and all its deployments`);
    if (typed !== name) return print("Names did not match. Nothing was deleted.");
  }
  let result: unknown;
  try {
    result = await pxxl.deleteProject(projectId);
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}. If a deploy just finished or failed, wait a few seconds and run pxxl rm again.`);
  }
  if (args.includes("--json")) return json(result);
  done(`Deleted ${name}`);
  const cwd = resolve(flag(args, "--dir") || ".");
  const config = await readPxxlToml(cwd);
  if (config.projectId === projectId) { delete config.projectId; delete config.deploymentId; await writeDefaultPxxlFiles(cwd, config); print(dim("  Unlinked this folder.")); }
}

const SETTING_FLAGS: Record<string, string> = {
  "--build-command": "buildCommand", "--start-command": "startCommand", "--install-command": "installCommand", "--root": "baseDirectory",
  "--branch": "branch", "--framework": "framework", "--node-version": "nodeVersion", "--health-path": "healthCheckPath", "--name": "name", "--port": "port",
};

export async function projectSettingsCommand(pxxl: Pxxl, ctx: PlatformContext, sub: string, args: string[]) {
  const projectId = await ctx.resolveProject(args);
  if (sub === "update" || sub === "set") {
    const settings: Record<string, unknown> = {};
    for (const [name, field] of Object.entries(SETTING_FLAGS)) { const value = flag(args, name); if (value !== undefined) settings[field] = field === "port" ? Number(value) : value; }
    if (!Object.keys(settings).length) throw new Error(`Pass at least one of ${Object.keys(SETTING_FLAGS).join(", ")}`);
    const result = await pxxl.updateProject(projectId, settings);
    if (args.includes("--json")) return json(result);
    done("Updated " + Object.keys(settings).join(", "));
    return print(dim(`  Changes to build settings apply on the next deploy: ${cyan("pxxl redeploy")}`));
  }
  if (sub === "auto-deploy") {
    const value = words(args)[0];
    if (value !== "on" && value !== "off") throw new Error("Usage: pxxl project auto-deploy on|off");
    const result = await pxxl.setAutoDeploy(projectId, value === "on");
    return args.includes("--json") ? json(result) : done(`Auto-deploy on git push is ${value}`);
  }
  if (sub === "history" || sub === "rollbacks") {
    const result = record(await pxxl.projectRollbacks(projectId));
    if (args.includes("--json")) return json(result);
    const rows = list(result.rollbacks || result.history || result.data).map(record);
    if (!rows.length) {
      // The history endpoint can lag; rollbacks also show up as deployments.
      const fromDeployments = (await projectDeployments(pxxl, projectId, 50)).filter((item) => /^rollback_/.test(text(item.id)) || /^rollback to /i.test(text(item.commitMessage)));
      if (!fromDeployments.length) return print("No rollbacks yet.");
      return table([["WHEN", "ROLLBACK", "STATUS", "DETAIL"].map(dim), ...fromDeployments.map((item) => [ago(item.createdAt), text(item.id), statusTone(deploymentStatus(item)), text(item.commitMessage)])]);
    }
    return table([["WHEN", "FROM", "TO", "BY"].map(dim), ...rows.map((row) => [ago(row.createdAt || row.created_at), text(row.fromDeploymentId || row.from), text(row.toDeploymentId || row.to || row.deploymentId), text(row.userEmail || row.by || "")])]);
  }
  if (sub === "usage") {
    const result = await pxxl.projectComputeUsage(projectId);
    if (args.includes("--json")) return json(result);
    print(bold("Compute usage"));
    return kv(Object.entries(record(record(result).usage || record(result).data || result)).filter(([, value]) => typeof value !== "object").map(([name, value]) => [name, value]));
  }
  throw new Error(`Unknown project command: ${sub}`);
}
