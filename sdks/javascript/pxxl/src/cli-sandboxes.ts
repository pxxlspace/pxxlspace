import { readFile } from "node:fs/promises";
import { PxxlAPIError, resolvePxxlAPIBaseURL, type Pxxl, type Sandbox, type SandboxInfo, type SandboxPricing } from "./index.js";
import type { PlatformContext } from "./cli-platform.js";

// `pxxl sandbox`: isolated Linux sandboxes, billed per second from the wallet.

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
const text = (value: unknown) => (value === undefined || value === null ? "" : String(value));
const stripAnsi = (value: string) => value.replace(/\u001b\[[0-9;]*m/g, "");
const done = (message: string) => print(`${green("✓")} ${message}`);

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
const ago = (value: unknown) => {
  const time = new Date(text(value)).getTime();
  if (!Number.isFinite(time) || !text(value)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.round(seconds / 60)}m ago` : seconds < 86400 ? `${Math.round(seconds / 3600)}h ago` : `${Math.round(seconds / 86400)}d ago`;
};
const bytes = (value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || value === undefined || value === null) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = number;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
};
/** $4.32, $0.048, $0.0012: enough digits to see small per-second amounts. */
export const usd = (value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  if (number === 0) return "$0";
  if (Math.abs(number) >= 1) return `$${number.toFixed(2)}`;
  return `$${number.toFixed(4).replace(/0{1,2}$/, "")}`;
};
const memory = (mb: unknown) => { const number = Number(mb); return Number.isFinite(number) && number > 0 ? (number >= 1024 ? `${+(number / 1024).toFixed(1)} GB` : `${number} MB`) : ""; };
const autoStop = (minutes: unknown) => (minutes === undefined || minutes === null ? "" : Number(minutes) === 0 ? "never" : `after ${minutes} min idle`);

export const sandboxStatus = (status: string) => {
  if (status === "running") return green(status);
  if (status === "failed") return red(status);
  if (status === "paused_low_balance" || status === "paused_insufficient_points") return red(status);
  if (status === "creating" || status === "starting" || status.startsWith("paused") || status === "stopped") return yellow(status);
  return status;
};

export const sandboxHelp = `${bold("pxxl sandbox")} – isolated Linux sandboxes, billed per second from your wallet

  ${cyan("pxxl sandbox list")}                       Your sandboxes, what is running and this month's spend
  ${cyan("pxxl sandbox create")} [--wait]            Create one
      --name <name>  --template base|node|python|html|php  --size micro|small|medium|large
      --disk 2|5|10  --auto-stop <minutes, 0 = never>  --env KEY=VALUE (repeat)  --repo owner/repo
  ${cyan("pxxl sandbox get")} <sandbox>              Status, size, preview URL and cost
  ${cyan("pxxl sandbox exec")} <sandbox> -- <command…>
                                          Run a command; streams output and exits with its exit code
      --workdir <dir>  --timeout <seconds, max 300>
  ${cyan("pxxl sandbox files")} <sandbox> [path]     List files (default /workspace)
  ${cyan("pxxl sandbox read")} <sandbox> <path>      Print a file
  ${cyan("pxxl sandbox write")} <sandbox> <path> [--file local | --content text]
                                          Write a text file (up to 2 MB); reads stdin without --file
  ${cyan("pxxl sandbox start|stop")} <sandbox>       Resume or pause ($0 while paused, /workspace kept)
  ${cyan("pxxl sandbox delete")} <sandbox> [--yes]   Delete it and its /workspace
  ${cyan("pxxl sandbox update")} <sandbox> [--name x] [--auto-stop <minutes>]
  ${cyan("pxxl sandbox usage")} <sandbox>            What it has cost so far
  ${cyan("pxxl sandbox summary")}                     Running now, spend this month, wallet runway, hints
  ${cyan("pxxl sandbox preview")} <sandbox>          A link to the preview (12-hour token when private)
      create/update take --private or --public; exec takes --background
  ${cyan("pxxl sandbox logs")} <sandbox>             Provisioning events and container output
  ${cyan("pxxl sandbox terminal")} <sandbox>         Interactive shell (Ctrl-] disconnects); --url prints the WebSocket URL
  ${cyan("pxxl sandbox pricing")}                    Rates, sizes and plan limits

<sandbox> is an id or a name. Add --team <id> for a spaceship's sandboxes and --json for raw API output.
Sandboxes are on Plus and above. $0.012 per vCPU-hour and $0.006 per GB-hour of memory, 10 GB disk included.`;

const VALUE_FLAGS = new Set(["--name", "--template", "--size", "--disk", "--auto-stop", "--env", "-e", "--cpus", "--memory", "--repo", "--team", "--file", "--content", "--workdir", "-w", "--timeout", "--path"]);

/** Flags and positionals before `--`, and everything after it. */
function parse(args: string[]) {
  const split = args.indexOf("--");
  const head = split >= 0 ? args.slice(0, split) : args;
  const tail = split >= 0 ? args.slice(split + 1) : [];
  const positional: string[] = [];
  const flags = new Map<string, string[]>();
  const switches = new Set<string>();
  for (let index = 0; index < head.length; index += 1) {
    const arg = head[index]!;
    if (!arg.startsWith("-") || arg === "-") { positional.push(arg); continue; }
    const eq = arg.indexOf("=");
    const name = eq > 0 ? arg.slice(0, eq) : arg;
    if (VALUE_FLAGS.has(name)) {
      const value = eq > 0 ? arg.slice(eq + 1) : head[index + 1];
      if (eq < 0) index += 1;
      if (value === undefined) throw new Error(`${name} needs a value`);
      flags.set(name, [...(flags.get(name) || []), value]);
    } else switches.add(name);
  }
  const flag = (...names: string[]) => { for (const name of names) { const values = flags.get(name); if (values?.length) return values[values.length - 1]; } return undefined; };
  const all = (...names: string[]) => names.flatMap((name) => flags.get(name) || []);
  const integer = (name: string) => {
    const raw = flag(name);
    if (raw === undefined) return undefined;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a whole number`);
    return value;
  };
  return { positional, tail, flag, all, integer, has: (name: string) => switches.has(name), hasSeparator: split >= 0 };
}

async function findSandbox(pxxl: Pxxl, ctx: PlatformContext, ref: string | undefined, teamId?: string): Promise<Sandbox> {
  if (ref) {
    try {
      return await pxxl.sandboxes.get(ref, { teamId });
    } catch (error) {
      if (!(error instanceof PxxlAPIError) || ![400, 404].includes(error.status)) throw error;
      const { sandboxes } = await pxxl.sandboxes.list({ teamId });
      const lower = ref.toLowerCase();
      const found = sandboxes.find((box) => box.name.toLowerCase() === lower);
      if (found) return found;
      throw new Error(`No sandbox named or with id "${ref}". Run pxxl sandbox list to see yours.`);
    }
  }
  const { sandboxes } = await pxxl.sandboxes.list({ teamId });
  if (sandboxes.length === 1) return sandboxes[0]!;
  if (!sandboxes.length) throw new Error(`No sandboxes yet. Create one with ${cyan("pxxl sandbox create")}.`);
  if (!ctx.interactive()) throw new Error("Name the sandbox (pxxl sandbox list to see them).");
  const id = await ctx.promptSelect("Sandbox", sandboxes.map((box) => ({ label: `${box.name} ${dim(box.status)}`, value: box.id, name: box.name })));
  return sandboxes.find((box) => box.id === id)!;
}

function printSandbox(info: SandboxInfo) {
  print(`${bold(info.name || info.id)}  ${sandboxStatus(text(info.status))}`);
  const preview = info.previewUrl || (info.domain ? `https://${info.domain}` : "");
  kv([
    ["ID", info.id],
    ["Preview", preview],
    ["Template", text(info.template)],
    ["Size", `${info.size ? `${info.size} · ` : ""}${info.cpus} vCPU · ${memory(info.memoryMb)}`],
    ["Disk", info.diskGb ? `${info.diskGb} GB` : info.volumeLimitMb ? memory(info.volumeLimitMb) : ""],
    ["Price", info.hourlyUsd !== undefined ? `${usd(info.hourlyUsd)}/hour while running, $0 while paused` : ""],
    ["Auto-stop", autoStop(info.autoStopMinutes)],
    ["Billed", info.billedUsd !== undefined ? `${usd(info.billedUsd)}${Number(info.unbilledUsd) > 0 ? dim(` + ${usd(info.unbilledUsd)} not yet billed`) : ""}` : ""],
    ["Started", ago(info.startedAt)],
    ["Last activity", ago(info.lastActivityAt)],
    ["Created", ago(info.createdAt)],
  ]);
  if (info.status === "paused_low_balance") print(red("\nPaused: your wallet ran low. Top up, then pxxl sandbox start."));
}

async function waitForSandbox(box: Sandbox, asJSON: boolean) {
  let shown = "";
  const until = Date.now() + 5 * 60_000;
  for (;;) {
    if (box.status !== shown && !asJSON) { shown = box.status; print(dim(`  ${shown}`)); }
    if (box.status === "running" || box.status === "failed" || Date.now() > until) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await box.refresh();
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function printPricing(pricing: SandboxPricing) {
  print(`${bold("Sandboxes")}  ${usd(pricing.vcpuHourUsd)} per vCPU-hour · ${usd(pricing.gbHourUsd)} per GB-hour of memory · billed per second`);
  print("");
  const sizes = pricing.sizes || [];
  if (sizes.length) {
    table([["SIZE", "CPU", "MEMORY", "PER HOUR", "8 H/DAY FOR 30 DAYS"].map(dim), ...sizes.map((size) => [
      text(size.id), `${size.cpus} vCPU`, memory(size.memoryMb), usd(size.hourlyUsd), usd(Number(size.hourlyUsd) * 240),
    ])]);
    print("");
  }
  const disk = pricing.diskOptionsGb?.length ? ` (${pricing.diskOptionsGb.join(", ")} GB)` : "";
  print(`Disk: ${pricing.diskIncludedGb ?? 10} GB included${disk}. Paused or stopped: $0, /workspace is kept.`);
  if (pricing.minimumBalanceUsd !== undefined) print(`Starting a sandbox needs ${usd(pricing.minimumBalanceUsd)} in your wallet; it pauses when the wallet runs low.`);
  const templates = (pricing.templates || []).map((template) => template.id);
  if (templates.length) print(`Templates: ${templates.join(", ")}`);
  const plans = Object.entries(pricing.plans || {});
  if (plans.length) {
    print("");
    table([["PLAN", "RUNNING", "TOTAL", "LARGEST"].map(dim), ...plans.map(([plan, limits]) => [
      plan[0]!.toUpperCase() + plan.slice(1), text(limits.maxRunning), text(limits.maxTotal), `${limits.maxCpus} vCPU · ${memory(limits.maxMemoryMb)}`,
    ])]);
  }
}

function websocketURL(raw: string): string {
  const base = new URL(resolvePxxlAPIBaseURL());
  const url = new URL(raw, base.origin);
  if (url.protocol === "https:") url.protocol = "wss:";
  if (url.protocol === "http:") url.protocol = "ws:";
  return url.toString();
}

async function terminal(box: Sandbox, printOnly: boolean, asJSON: boolean) {
  const ticket = await box.terminalTicket();
  if (!ticket.wsUrl) throw new Error("The Gateway did not return a terminal URL.");
  const url = websocketURL(ticket.wsUrl);
  if (asJSON) return json({ ...ticket, wsUrl: url });
  if (printOnly) return print(url);
  let WebSocket: typeof import("ws").default;
  try {
    WebSocket = (await import("ws")).default;
  } catch {
    print(`No WebSocket library is available. Connect to this URL within ${ticket.expiresIn || 60}s with any WebSocket client:\n\n  ${url}\n`);
    return print(dim('Send {"type":"input","data":"ls\\n"} and {"type":"resize","cols":120,"rows":40}; output arrives as {"type":"output","data":"…"}.'));
  }
  const socket = new WebSocket(url, { handshakeTimeout: 20_000 });
  const stdin = process.stdin;
  const raw = stdin.isTTY;
  const send = (message: Record<string, unknown>) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); };
  const resize = () => send({ type: "resize", cols: process.stdout.columns || 120, rows: process.stdout.rows || 40 });
  const onInput = (chunk: Buffer) => {
    if (chunk.includes(0x1d)) { send({ type: "close" }); socket.close(); return; } // Ctrl-]
    send({ type: "input", data: chunk.toString("utf8") });
  };
  return new Promise<void>((resolve, reject) => {
    let failed = "";
    const cleanup = () => {
      stdin.off("data", onInput);
      process.stdout.off("resize", resize);
      if (raw) stdin.setRawMode(false);
      stdin.pause();
    };
    socket.on("open", () => {
      process.stderr.write(dim(`Connected to ${box.name || box.id}. Ctrl-] disconnects.\n`));
      if (raw) stdin.setRawMode(true);
      stdin.resume();
      stdin.on("data", onInput);
      // Piped input: leave a moment for the last output, then disconnect.
      if (!raw) stdin.once("end", () => setTimeout(() => { send({ type: "close" }); socket.close(); }, 1500));
      process.stdout.on("resize", resize);
      resize();
    });
    socket.on("message", (data) => {
      let message: Record<string, unknown>;
      try { message = JSON.parse(data.toString()) as Record<string, unknown>; } catch { process.stdout.write(data.toString()); return; }
      if (message.type === "output") process.stdout.write(text(message.data));
      else if (message.type === "error") failed = text(message.data || message.message || message.reason) || "Terminal error";
      else if (message.type === "closed") socket.close();
    });
    socket.on("error", (error) => { failed = failed || error.message; });
    socket.on("close", () => {
      cleanup();
      process.stderr.write(dim("\nDisconnected.\n"));
      if (failed) reject(new Error(failed));
      else resolve();
    });
  });
}

function printHints(hints?: { message: string }[]) {
  for (const hint of hints ?? []) print(`${cyan("›")} ${hint.message}`);
}

/** Run `pxxl sandbox …`. `getClient(false)` may return a client without an API key (for pricing). */
export async function sandboxCommand(getClient: (needsKey: boolean) => Promise<Pxxl>, ctx: PlatformContext, args: string[]) {
  const [sub = "list", ...rest] = args;
  const options = parse(rest);
  const asJSON = options.has("--json");
  const teamId = options.flag("--team");

  if (sub === "pricing" || sub === "prices") {
    const pricing = await (await getClient(false)).sandboxes.pricing();
    return asJSON ? json(pricing) : printPricing(pricing);
  }
  const pxxl = await getClient(true);

  if (sub === "list" || sub === "ls") {
    const result = await pxxl.sandboxes.list({ teamId });
    if (asJSON) return json({ ...result, sandboxes: result.sandboxes.map((box) => box.info) });
    if (!result.sandboxes.length) return print(`No sandboxes yet. Create one with ${cyan("pxxl sandbox create --template node")}.`);
    table([["NAME", "STATUS", "SIZE", "PER HOUR", "AUTO-STOP", "PREVIEW", "ID"].map(dim), ...result.sandboxes.map((box) => {
      const info = box.info;
      return [box.name, sandboxStatus(box.status), text(info.size || `${info.cpus}/${memory(info.memoryMb)}`), usd(info.hourlyUsd), info.autoStopMinutes === 0 ? "never" : info.autoStopMinutes ? `${info.autoStopMinutes}m` : "", box.previewUrl || "", box.id];
    })]);
    const usage = result.usage;
    if (usage) print(dim(`\n${usage.runningCount} running · ${usd(usage.hourlyBurnUsd)}/hour now · ${usd(usage.monthToDateUsd)} this month`));
    printHints((result as { hints?: { message: string }[] }).hints);
    return;
  }

  if (sub === "summary" || sub === "status") {
    const summary = await pxxl.sandboxes.summary({ teamId });
    if (asJSON) return json(summary);
    print(`${bold("Sandboxes")}  ${summary.running} running · ${summary.paused} paused · ${usd(summary.hourlyBurnUsd)}/hour now`);
    print(`This month  ${usd(summary.monthToDateUsd)} · ${summary.vcpuHoursMonth} vCPU-h · ${summary.gbHoursMonth} GB-h · ${summary.storageGb} GB reserved`);
    print(`Wallet      ${usd(summary.walletUsd)}${summary.runwayHours != null ? ` · lasts ~${summary.runwayHours} h at this rate` : ""}`);
    printHints(summary.hints);
    return;
  }

  if (sub === "create" || sub === "new") {
    const env: Record<string, string> = {};
    for (const pair of options.all("--env", "-e")) {
      const eq = pair.indexOf("=");
      if (eq <= 0) throw new Error(`--env takes KEY=VALUE, got "${pair}"`);
      env[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
    const box = await pxxl.sandboxes.create({
      name: options.flag("--name") || options.positional[0],
      template: options.flag("--template"),
      size: options.flag("--size"),
      cpus: options.integer("--cpus"),
      memoryMb: options.integer("--memory"),
      diskGb: options.integer("--disk"),
      autoStopMinutes: options.integer("--auto-stop"),
      env: Object.keys(env).length ? env : undefined,
      sourceRepository: options.flag("--repo"),
      previewAccess: options.has("--private") ? "private" : undefined,
      teamId,
    });
    if (!asJSON) done(`Created ${bold(box.name || box.id)} ${dim(box.id)}`);
    if (options.has("--wait")) await waitForSandbox(box, asJSON);
    if (asJSON) return json({ sandbox: box.info });
    if (box.status === "failed") { process.exitCode = 1; return print(red(`${box.name} failed to start. pxxl sandbox logs ${box.id} shows why.`)); }
    print("");
    printSandbox(box.info);
    print(dim(`\nNext: pxxl sandbox exec ${box.name || box.id} -- node --version${box.status === "running" ? "" : "   (once it is running; add --wait to create to wait)"}`));
    return;
  }

  // Everything below works on one sandbox.
  const box = await findSandbox(pxxl, ctx, options.positional[0], teamId);
  const label = box.name || box.id;
  const more = options.positional.slice(1);

  if (sub === "get" || sub === "show" || sub === "info" || sub === "status") {
    return asJSON ? json({ sandbox: box.info }) : printSandbox(box.info);
  }

  if (sub === "exec" || sub === "run") {
    const command = (options.tail.length ? options.tail : more).join(" ").trim();
    if (!command) throw new Error("Usage: pxxl sandbox exec <sandbox> -- <command…>");
    const timeout = options.integer("--timeout");
    const workdir = options.flag("--workdir", "-w");
    if (options.has("--background")) {
      const started = await box.exec(command, { workdir, background: true });
      if (asJSON) return json(started);
      return done(`Started in the background (pid ${started.pid}). Output: ${started.logFile}\n  ${dim(`pxxl sandbox exec ${box.id} -- tail -n 50 ${started.logFile}`)}`);
    }
    if (asJSON) {
      const result = await box.exec(command, { workdir, timeoutSeconds: timeout });
      json(result);
      process.exitCode = result.timedOut ? 124 : result.exitCode;
      return;
    }
    let last = "";
    const result = await box.exec(command, { workdir, timeoutSeconds: timeout, onOutput: (chunk) => { last = chunk || last; process.stdout.write(chunk); } });
    if (last && !last.endsWith("\n") && process.stdout.isTTY) process.stdout.write("\n");
    if (result.truncated) process.stderr.write(dim("(output truncated)\n"));
    if (result.timedOut) process.stderr.write(red(`Timed out after ${timeout || "the maximum"} seconds.\n`));
    process.exitCode = result.timedOut ? 124 : result.exitCode;
    return;
  }

  if (sub === "files" || sub === "ls-files") {
    const path = options.flag("--path") || more[0];
    const files = await box.files.list(path);
    if (asJSON) return json({ files });
    if (!files.length) return print(`Nothing in ${path || "/workspace"}.`);
    return table([["TYPE", "SIZE", "PATH"].map(dim), ...files.map((file) => [file.type === "directory" || file.type === "dir" ? cyan("dir") : "file", file.type === "file" ? bytes(file.size) : "", file.type === "directory" || file.type === "dir" ? cyan(`${file.path}/`) : file.path])]);
  }

  if (sub === "read" || sub === "cat") {
    const path = options.flag("--path") || more[0];
    if (!path) throw new Error("Usage: pxxl sandbox read <sandbox> <path>");
    const file = await box.files.get(path);
    if (asJSON) return json(file);
    process.stdout.write(file.content);
    if (file.content && !file.content.endsWith("\n") && process.stdout.isTTY) process.stdout.write("\n");
    return;
  }

  if (sub === "write" || sub === "put") {
    const path = options.flag("--path") || more[0];
    if (!path) throw new Error("Usage: pxxl sandbox write <sandbox> <path> [--file local | --content text]");
    const local = options.flag("--file");
    const inline = options.flag("--content");
    let content: string;
    if (local) content = await readFile(local, "utf8");
    else if (inline !== undefined) content = inline;
    else if (!process.stdin.isTTY) content = await readStdin();
    else throw new Error("Pass --file <local path> or --content <text>, or pipe the content in.");
    const result = await box.files.write(path, content);
    return asJSON ? json(result) : done(`Wrote ${bytes(Buffer.byteLength(content))} to ${path} on ${label}`);
  }

  if (sub === "start" || sub === "resume") {
    await box.start();
    if (options.has("--wait")) await waitForSandbox(box, asJSON);
    if (asJSON) return json({ sandbox: box.info });
    return box.status === "running" ? done(`${label} is running ${box.previewUrl ? dim(box.previewUrl) : ""}`) : done(`Starting ${label} ${dim(`(${box.status})`)}`);
  }

  if (sub === "stop" || sub === "pause") {
    await box.stop();
    return asJSON ? json({ sandbox: box.info }) : done(`Paused ${label}. Billing stopped; /workspace is kept.`);
  }

  if (sub === "delete" || sub === "rm" || sub === "remove") {
    if (!options.has("--yes") && !options.has("-y")) {
      if (!ctx.interactive()) throw new Error(`Deleting ${label} also deletes its /workspace and cannot be undone. Pass --yes to confirm.`);
      if (!(await ctx.promptConfirm(`Delete ${label} and its /workspace? This cannot be undone.`, false))) return print("Cancelled.");
    }
    const result = await box.delete();
    return asJSON ? json(result) : done(`Deleted ${label}`);
  }

  if (sub === "update" || sub === "set" || sub === "rename" || sub === "auto-stop") {
    const name = options.flag("--name") || (sub === "rename" ? more[0] : undefined);
    const minutes = options.integer("--auto-stop") ?? (sub === "auto-stop" && more[0] !== undefined ? Number(more[0]) : undefined);
    const previewAccess = options.has("--private") ? "private" : options.has("--public") ? "public" : undefined;
    if (name === undefined && minutes === undefined && !previewAccess) throw new Error("Usage: pxxl sandbox update <sandbox> [--name x] [--auto-stop <minutes>] [--private | --public]");
    await box.update({ name, autoStopMinutes: minutes, previewAccess });
    return asJSON ? json({ sandbox: box.info }) : done(`Updated ${box.name || label}${minutes !== undefined ? `: auto-stop ${autoStop(minutes)}` : ""}${previewAccess ? `: preview ${previewAccess}` : ""}`);
  }

  if (sub === "preview" || sub === "open") {
    const link = await box.previewLink();
    if (asJSON) return json(link);
    print(link.url);
    if (link.access === "private") print(dim(`Private preview: this link works for 12 hours${link.expiresAt ? ` (until ${link.expiresAt})` : ""}.`));
    return;
  }

  if (sub === "usage" || sub === "cost") {
    const usage = await box.usage();
    if (asJSON) return json(usage);
    print(`${bold(label)}  ${usd(usage.hourlyUsd)}/hour while running`);
    kv([["Billed", usd(usage.billedUsd)], ["Not yet billed", usd(usage.unbilledUsd)]]);
    const ledger = usage.ledger || [];
    if (ledger.length) {
      print("");
      table([["STARTED", "RAN FOR", "COST"].map(dim), ...ledger.slice(-20).map((entry) => [new Date(entry.startedAt).toLocaleString(), `${Math.round(Number(entry.seconds) / 60)} min`, usd(entry.amountUsd)])]);
    }
    return;
  }

  if (sub === "logs" || sub === "log") {
    const result = await box.logs();
    if (asJSON) return json(result);
    for (const event of result.events || []) print(`${dim(ago(event.createdAt || event.created_at).padEnd(8))} ${text(event.type || event.eventType)}  ${dim(text(event.message || event.details))}`);
    if (result.logs) print(`\n${result.logs.trimEnd()}`);
    if (!result.events?.length && !result.logs) print("No logs yet.");
    return;
  }

  if (sub === "terminal" || sub === "shell" || sub === "ssh") {
    return terminal(box, options.has("--url"), asJSON);
  }

  throw new Error(`Unknown sandbox command: ${sub}. Run pxxl sandbox --help.`);
}
