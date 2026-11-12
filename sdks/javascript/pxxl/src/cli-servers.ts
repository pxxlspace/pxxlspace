import type { Pxxl, ServerAction } from "./index.js";
import { flag, statusTone, words, type PlatformContext } from "./cli-platform.js";

// `pxxl servers`: bring-your-own servers linked to Pxxl.

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
const stripAnsi = (value: string) => value.replace(/\u001b\[[0-9;]*m/g, "");
const done = (message: string) => print(`${green("✓")} ${message}`);
const ago = (value: unknown) => {
  const time = new Date(text(value)).getTime();
  if (!Number.isFinite(time) || !text(value)) return "-";
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.round(seconds / 60)}m ago` : seconds < 86400 ? `${Math.round(seconds / 3600)}h ago` : `${Math.round(seconds / 86400)}d ago`;
};
const bytes = (value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = number;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
};
function table(rows: string[][]) {
  const widths = rows[0]!.map((_, column) => Math.max(...rows.map((row) => stripAnsi(row[column] || "").length)));
  for (const row of rows) print(row.map((cell, column) => cell + " ".repeat(Math.max(0, widths[column]! - stripAnsi(cell).length))).join("  ").trimEnd());
}
function kv(rows: Array<[string, unknown]>) {
  const shown = rows.filter(([, value]) => text(value) !== "" && text(value) !== "-");
  if (!shown.length) return;
  const width = Math.max(...shown.map(([name]) => name.length));
  for (const [name, value] of shown) print(`  ${dim(name.padEnd(width))}  ${text(value)}`);
}
const bar = (percent: number) => { const filled = Math.max(0, Math.min(20, Math.round(percent / 5))); const color = percent >= 90 ? red : percent >= 75 ? yellow : green; return `${color("█".repeat(filled))}${dim("░".repeat(20 - filled))}`; };

export const serversHelp = `${bold("pxxl servers")} – your own servers, linked to Pxxl

  ${cyan("pxxl servers")}                          List servers and whether they are online
  ${cyan("pxxl servers add")} <name>               Link a new server: prints the command to run on it
  ${cyan("pxxl servers show")} [server]            Details, resources and apps
  ${cyan("pxxl servers health")} [server]          Checks: agent, Docker, disk, memory
  ${cyan("pxxl servers metrics")} [server]         CPU, memory and disk now
  ${cyan("pxxl servers apps")} [server]            Apps placed on it
  ${cyan("pxxl servers events|alerts")} [server]   What happened recently
  ${cyan("pxxl servers logs")} [server] --app <a>  Recent output of an app (or the agent)
  ${cyan("pxxl servers restart|start|stop")} [server] --app <a>
  ${cyan("pxxl servers update|prune")} [server]    Update the agent / free Docker space
  ${cyan("pxxl servers ops")}                      Operations you can run
  ${cyan("pxxl servers run")} [server] <op> [--app <a>] [-n 200] [--change]
  ${cyan("pxxl servers settings")} [server] [--set key=value]
  ${cyan("pxxl servers rename")} [server] <name>
  ${cyan("pxxl servers link")} [server]            New install command (after reinstalling the machine)
  ${cyan("pxxl servers rm")} [server] --yes        Unlink and forget a server

[server] is a name or id; with one server it can be left out. Add --team <id> for a spaceship's servers.
Servers are included on Plus and above.`;

const serversOf = (value: unknown) => { const root = record(value); return list(root.servers || root.data || value).map(record); };
const serverOf = (value: unknown) => { const root = record(value); return record(root.server || root.data || root); };
const serverState = (server: Record<string, any>) => text(server.state || server.status || server.enrollmentState || server.connection || "unknown");

async function pickServer(pxxl: Pxxl, ctx: PlatformContext, wanted?: string, teamId?: string): Promise<Record<string, any>> {
  const servers = serversOf(await pxxl.servers.list({ teamId }));
  if (wanted) {
    const lower = wanted.toLowerCase();
    const found = servers.find((server) => text(server.id) === wanted) || servers.find((server) => text(server.name).toLowerCase() === lower) || servers.find((server) => text(server.hostname).toLowerCase() === lower);
    if (!found) throw new Error(`No server named "${wanted}". Run pxxl servers to see yours.`);
    return found;
  }
  if (servers.length === 1) return servers[0]!;
  if (!servers.length) throw new Error(`No servers yet. Link one with ${cyan("pxxl servers add <name>")}.`);
  if (!ctx.interactive()) throw new Error("Name the server (pxxl servers to list them).");
  const id = await ctx.promptSelect("Server", servers.map((server) => ({ label: `${text(server.name)} ${dim(serverState(server))}`, value: text(server.id) })));
  return servers.find((server) => text(server.id) === id)!;
}

function printInstall(value: unknown) {
  const root = record(value);
  const command = text(root.installCommand || root.command || record(root.install).command || record(root.server).installCommand);
  const expires = root.expiresAt || root.tokenExpiresAt;
  if (!command) return;
  print(`\nRun this on the server as root ${dim("(Ubuntu, Debian, Alpine and most Linux; a container runtime is installed if missing)")}:\n`);
  print(`  ${cyan(command)}\n`);
  if (expires) print(dim(`The command works once and expires ${new Date(text(expires)).toLocaleString()}.`));
  print(dim("The server shows as online here within a minute of finishing."));
}

const DESTRUCTIVE: ServerAction[] = ["stop", "prune", "update"];

export async function serversCommand(pxxl: Pxxl, ctx: PlatformContext, args: string[]) {
  const [sub = "list", ...rest] = args;
  const asJSON = args.includes("--json");
  const teamId = flag(args, "--team");
  const positional = words(rest);

  if (sub === "list" || sub === "ls") {
    const result = await pxxl.servers.list({ teamId });
    if (asJSON) return json(result);
    const servers = serversOf(result);
    if (!servers.length) return print(`No servers yet. Link one with ${cyan("pxxl servers add my-server")}.`);
    table([["NAME", "STATE", "HOST", "CPU", "MEMORY", "APPS", "LAST SEEN", "ID"].map(dim), ...servers.map((server) => [
      text(server.name), statusTone(serverState(server)), text(server.hostname || server.ip || "-"),
      text(server.cpuCores ?? server.cpu_cores ?? "-"), bytes(Number(server.memoryMb ?? server.memory_mb ?? 0) * 1048576),
      text(server.projectCount ?? server.apps ?? list(server.projects).length ?? "-"), ago(server.lastSeenAt || server.last_seen_at), text(server.id),
    ])]);
    const root = record(result);
    const allowance = record(root.entitlement || root.allowance || root.plan);
    const included = allowance.included ?? root.included;
    if (included !== undefined) print(dim(`\n${servers.length} linked · ${included} included on your plan${allowance.extraPriceUsd || root.extraPriceUsd ? ` · extra $${allowance.extraPriceUsd || root.extraPriceUsd}/server/month` : ""}`));
    return;
  }
  if (sub === "add" || sub === "create") {
    const name = positional[0] || flag(args, "--name") || (ctx.interactive() ? await ctx.promptText("Server name", "my-server") : "");
    if (!name) throw new Error("Usage: pxxl servers add <name>");
    const result = await pxxl.servers.create({ name, teamId });
    if (asJSON) return json(result);
    done(`Created ${bold(name)} ${dim(text(serverOf(result).id))}`);
    return printInstall(result);
  }
  if (sub === "ops") {
    const result = await pxxl.servers.ops();
    if (asJSON) return json(result);
    const ops = list(record(result).ops).map(record);
    table([["OP", "KIND", "NEEDS", "WHAT IT DOES"].map(dim), ...ops.map((op) => [text(op.id || op.name || op.op), op.change || op.kind === "change" ? yellow("change") : "read", op.app || op.needsApp ? "--app" : "", text(op.description || op.title).slice(0, 70)])]);
    return print(dim(`\nRun one: pxxl servers run [server] <op>${ops.some((op) => op.change || op.kind === "change") ? "   (change ops need --change)" : ""}`));
  }

  // Everything below works on one server.
  const serverArg = ["run", "rename"].includes(sub) ? (positional.length > 1 ? positional[0] : undefined) : positional[0];
  const server = await pickServer(pxxl, ctx, serverArg, teamId);
  const id = text(server.id);
  const name = text(server.name || id);
  const rest2 = serverArg ? positional.slice(1) : positional;

  if (sub === "show" || sub === "get" || sub === "info") {
    const [detail, apps] = await Promise.all([pxxl.servers.get(id), pxxl.servers.projects(id).catch(() => ({}))]);
    if (asJSON) return json({ server: detail, apps });
    const info = serverOf(detail);
    print(`${bold(name)}  ${statusTone(serverState(info))}`);
    kv([
      ["ID", id], ["Host", text(info.hostname)], ["IP", text(info.ip)], ["OS", text(info.os)], ["Arch", text(info.architecture)],
      ["CPU", info.cpuCores ? `${info.cpuCores} cores` : ""], ["Memory", bytes(Number(info.memoryMb || 0) * 1048576)], ["Disk", info.diskGb ? `${info.diskGb} GB` : ""],
      ["Agent", text(info.agentVersion)], ["Linked", ago(info.linkedAt)], ["Last seen", ago(info.lastSeenAt)],
    ]);
    const appRows = list(record(apps).projects || record(apps).apps || record(apps).data).map(record);
    if (appRows.length) { print(`\n${bold("Apps")}`); for (const app of appRows) print(`  ${text(app.name || app.id)}  ${statusTone(text(app.status || app.state || ""))}  ${dim(text(app.domain || app.url || ""))}`); }
    return;
  }
  if (sub === "health") {
    const result = await pxxl.servers.health(id);
    if (asJSON) return json(result);
    const root = record(result.health || result.data || result);
    const checks = list(root.components || root.checks || root.items).map(record);
    const failing = checks.filter((check) => !/^(ok|pass|healthy|up)$/i.test(text(check.status)));
    const overall = failing.some((check) => /fail|error|down/i.test(text(check.status))) ? "unhealthy" : failing.length ? "warning" : serverState(server) === "online" ? "healthy" : serverState(server);
    print(`${bold(name)}  ${statusTone(overall)}  ${dim(root.updatedAt ? `checked ${ago(root.updatedAt)}` : "")}`);
    for (const check of checks) {
      const state = text(check.status || check.state || (check.ok ? "ok" : "fail"));
      const icon = /^(ok|pass|healthy|up)$/i.test(state) ? green("✓") : /warn/i.test(state) ? yellow("!") : red("✗");
      print(`  ${icon} ${text(check.name || check.title || check.id).padEnd(10)} ${dim(text(check.detail || check.message || check.value || ""))}`);
    }
    const meta = record(root.meta);
    kv([["Public IP", text(root.publicIp)], ["Machine", text(meta.machine || meta.provider)], ["Kernel", text(meta.kernel)], ["Auto-update", text(meta.autoUpdate)], ["Agent up since", root.agentStartedAt ? ago(root.agentStartedAt) : ""]].map(([key, value]) => [key, value]) as Array<[string, unknown]>);
    const apps = list(root.apps).map(record);
    if (apps.length) { print(`\n${bold("Apps")}`); for (const app of apps) print(`  ${statusTone(text(app.status || app.state || ""))} ${text(app.name || app.container)}  ${dim(text(app.detail || app.image || ""))}`); }
    return;
  }
  if (sub === "metrics") {
    const result = await pxxl.servers.metrics(id);
    if (asJSON) return json(result);
    const root = record(result.metrics || result.data || result);
    const points = list(root.points || root.samples || root.series).map(record);
    const latest = record(points[points.length - 1] || root.latest || root);
    const number = (value: unknown) => { const parsed = Number(value); return value === undefined || value === null || !Number.isFinite(parsed) ? undefined : parsed; };
    const cpu = number(latest.cpuPct ?? latest.cpuPercent ?? latest.cpu_percent ?? latest.appsCpuPct);
    const memory = number(latest.memoryUsedPct ?? latest.memoryPercent ?? latest.memory_percent);
    const disk = number(latest.diskUsedPct ?? latest.diskPercent ?? latest.disk_percent);
    const load = number(latest.load1);
    const cores = number(latest.cpuCores);
    print(`${bold(name)}  ${dim(latest.at ? `sampled ${ago(latest.at)}${root.bucketSeconds ? ` · ${Math.round(Number(root.bucketSeconds) / 60)} min buckets` : ""}` : "")}`);
    kv([
      ["Load", load !== undefined ? `${load.toFixed(2)}${cores ? dim(` on ${cores} cores (${Math.round((load / cores) * 100)}%)`) : ""}` : ""],
      ["Apps CPU", cpu !== undefined ? `${bar(cpu)} ${cpu.toFixed(0)}%` : ""],
      ["Memory", memory !== undefined ? `${bar(memory)} ${memory.toFixed(0)}%` : ""],
      ["Disk", disk !== undefined ? `${bar(disk)} ${disk.toFixed(0)}%` : ""],
      ["Apps", latest.appsRunning !== undefined ? `${latest.appsRunning} running${latest.appsMemoryBytes ? dim(`, ${bytes(latest.appsMemoryBytes)}`) : ""}` : ""],
    ]);
    if (points.length > 1) {
      const spark = (values: number[], max: number) => values.slice(-30).map((value) => "▁▂▃▄▅▆▇█"[Math.max(0, Math.min(7, Math.floor((value / Math.max(1, max)) * 7.99)))]).join("");
      print(dim(`\n  ${points.length} samples`));
      const loads = points.map((point) => Number(point.load1 ?? 0));
      kv([["Memory trend", `${spark(points.map((point) => Number(point.memoryUsedPct ?? 0)), 100)}  ${dim("of 100%")}`], ["Load trend", `${spark(loads, Math.max(Number(cores || 1), ...loads))}  ${dim(`peak ${Math.max(...loads).toFixed(2)}`)}`]]);
    }
    return;
  }
  if (sub === "apps" || sub === "projects") {
    const result = await pxxl.servers.projects(id);
    if (asJSON) return json(result);
    const apps = list(record(result).projects || record(result).apps || record(result).data).map(record);
    if (!apps.length) return print(`No apps on ${name} yet.`);
    return table([["APP", "STATUS", "DOMAIN", "ID"].map(dim), ...apps.map((app) => [text(app.name), statusTone(text(app.status || app.state || "")), text(app.domain || app.url || ""), text(app.id)])]);
  }
  if (sub === "events" || sub === "alerts") {
    const result = sub === "events" ? await pxxl.servers.events(id) : await pxxl.servers.alerts(id);
    if (asJSON) return json(result);
    const rows = list(record(result).events || record(result).alerts || record(result).data).map(record);
    if (!rows.length) return print(sub === "events" ? "No events yet." : `${green("✓")} No alerts.`);
    const limit = Number(flag(args, "--limit")) || (sub === "alerts" ? 15 : 25);
    if (sub === "alerts") {
      const open = rows.filter((row) => !row.resolvedAt);
      print(open.length ? `${red("●")} ${open.length} open alert${open.length === 1 ? "" : "s"}` : `${green("✓")} No open alerts ${dim(`(${rows.length} resolved)`)}`);
      return table([["OPENED", "STATE", "KIND", "DETAIL"].map(dim), ...rows.slice(0, limit).map((row) => [ago(row.openedAt || row.createdAt), row.resolvedAt ? dim(`resolved ${ago(row.resolvedAt)}`) : red("open"), statusTone(text(row.kind || row.level)), text(row.message || row.subject).slice(0, 80)])]);
    }
    return table([["WHEN", "KIND", "DETAIL"].map(dim), ...rows.slice(0, limit).map((row) => [ago(row.createdAt || row.at || row.time), statusTone(text(row.kind || row.type || row.severity || row.level)), text(row.message || row.detail || row.title).slice(0, 100)])]);
  }
  if (["restart", "start", "stop", "update", "prune", "logs"].includes(sub)) {
    const action = sub as ServerAction;
    const app = flag(args, "--app") || (["restart", "start", "stop", "logs"].includes(action) ? rest2[0] : undefined);
    if (["restart", "start", "stop", "logs"].includes(action) && !app) {
      const apps = list(record(await pxxl.servers.projects(id).catch(() => ({}))).projects).map((item) => text(record(item).name || record(item).container)).filter(Boolean);
      throw new Error(`${action} works on one app: pass --app <name>.${apps.length ? ` Apps on ${name}: ${apps.join(", ")}` : ` ${name} has no apps yet.`} For the whole server use pxxl servers update or prune.`);
    }
    if (DESTRUCTIVE.includes(action) && !args.includes("--yes") && ctx.interactive() && !(await ctx.promptConfirm(`${action[0]!.toUpperCase()}${action.slice(1)} ${app || name}?`, false))) return print("Cancelled.");
    print(dim(`${action} ${app ? `${app} on ` : ""}${name}…`));
    let shown = "";
    const final = await pxxl.servers.runAction(id, action, { app, onUpdate: (status) => { const state = text(status.status); if (state !== shown && !asJSON) { shown = state; print(dim(`  ${state}`)); } } });
    if (asJSON) return json(final);
    const output = text(final.output || final.result || final.logs);
    if (output) print(`\n${output.trimEnd()}\n`);
    const ok = /^(succeeded|success|done|completed)$/i.test(text(final.status));
    if (ok) return done(`${action} finished`);
    print(`${red("✗")} ${action} ${statusTone(text(final.status || "unknown"))}${final.error ? `: ${final.error}` : ""}`);
    process.exitCode = 1;
    return;
  }
  if (sub === "run") {
    const op = rest2[0];
    if (!op) throw new Error("Usage: pxxl servers run [server] <op>   (pxxl servers ops lists them)");
    const change = args.includes("--change");
    if (change && !args.includes("--yes") && ctx.interactive() && !(await ctx.promptConfirm(`Run ${op} on ${name}? It changes the server.`, false))) return print("Cancelled.");
    const result = await pxxl.servers.runOp(id, op, { app: flag(args, "--app"), lines: Number(flag(args, "-n", "--lines")) || undefined, change });
    if (asJSON) return json(result);
    const root = record(result.action || result.result || result.op || result);
    const output = text(root.output || root.stdout || root.lines || root.text);
    print(`${bold(text(result.title) || op)} ${dim(`(${op}) on ${name}`)}  ${statusTone(text(root.status || (root.exitCode === 0 ? "ok" : root.exitCode !== undefined ? `exit ${root.exitCode}` : "done")))}`);
    if (output) print(`\n${output.trimEnd()}`);
    if (root.error) print(red(`\n${text(root.error)}`));
    return;
  }
  if (sub === "settings") {
    const sets = args.flatMap((arg, index) => (arg === "--set" && args[index + 1] ? [args[index + 1]!] : []));
    if (sets.length) {
      const patch: Record<string, unknown> = {};
      for (const pair of sets) {
        const [key, ...value] = pair.split("=");
        const raw = value.join("=");
        patch[key!] = raw === "true" ? true : raw === "false" ? false : raw !== "" && !Number.isNaN(Number(raw)) ? Number(raw) : raw;
      }
      const result = await pxxl.servers.updateSettings(id, patch);
      return asJSON ? json(result) : done(`Updated ${Object.keys(patch).join(", ")} on ${name}`);
    }
    const result = await pxxl.servers.settings(id);
    if (asJSON) return json(result);
    print(bold(`${name} settings`));
    return kv(Object.entries(record(result.settings || result.data || result)).filter(([, value]) => typeof value !== "object").map(([key, value]) => [key, value]));
  }
  if (sub === "rename") {
    const next = rest2[0];
    if (!next) throw new Error("Usage: pxxl servers rename [server] <new-name>");
    const result = await pxxl.servers.rename(id, next);
    return asJSON ? json(result) : done(`Renamed ${name} to ${bold(next)}`);
  }
  if (sub === "link" || sub === "link-token" || sub === "reinstall") {
    const result = await pxxl.servers.linkToken(id);
    if (asJSON) return json(result);
    done(`New install command for ${bold(name)}`);
    return printInstall(result);
  }
  if (sub === "rm" || sub === "remove" || sub === "delete") {
    if (!args.includes("--yes")) {
      if (!ctx.interactive()) throw new Error(`Unlinking ${name} cannot be undone. Pass --yes to confirm.`);
      const typed = await ctx.promptText(`Type ${bold(name)} to unlink it`);
      if (typed !== name) return print("Names did not match. Nothing changed.");
    }
    const result = await pxxl.servers.delete(id);
    return asJSON ? json(result) : done(`Unlinked ${name}. The machine keeps running; uninstall the agent there if you no longer need it.`);
  }
  throw new Error(`Unknown servers command: ${sub}. Run pxxl servers --help.`);
}
