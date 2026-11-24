import { PxxlAPIError, type PxxlClient } from "./index.js";

/**
 * Sandboxes: isolated Linux workspaces you create, run commands in and throw
 * away. Billed per second from your USD wallet while running, $0 while paused.
 * Paid plans only (Plus and up). Use an API key scoped to `all` or `sandbox`.
 *
 *   const sandbox = await pxxl.sandboxes.create({ template: "node", size: "small" });
 *   await sandbox.waitUntilReady();
 *   const { exitCode, output } = await sandbox.exec("node --version");
 *   await sandbox.stop();
 */

export type SandboxStatus =
  | "creating"
  | "running"
  | "paused"
  | "paused_idle"
  | "paused_low_balance"
  | "failed"
  | "stopped"
  | "paused_insufficient_points"
  | (string & {});
export type SandboxTemplate = "base" | "node" | "python" | "html" | "php" | (string & {});
export type SandboxSize = "micro" | "small" | "medium" | "large" | (string & {});

export interface SandboxInfo {
  id: string;
  name: string;
  template: SandboxTemplate;
  status: SandboxStatus;
  /** The public hostname of the app listening on $PORT (3000) inside the sandbox. */
  domain?: string;
  /** https://<domain>: public, anyone with the URL can open it. */
  previewUrl?: string;
  cpus: number;
  memoryMb: number;
  volumeLimitMb?: number;
  diskGb?: number;
  size?: SandboxSize;
  hourlyUsd: number;
  /** Minutes of inactivity before the sandbox pauses itself; 0 = never. */
  autoStopMinutes: number;
  billedUsd?: number;
  unbilledUsd?: number;
  startedAt?: string | null;
  stoppedAt?: string | null;
  lastActivityAt?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

export interface CreateSandboxOptions {
  name?: string;
  /** base (default), node, python, html or php. */
  template?: SandboxTemplate;
  /** micro (1 vCPU, 1 GB), small (2, 4 GB), medium (4, 8 GB) or large (8, 16 GB). */
  size?: SandboxSize;
  /** Custom vCPUs instead of a size. */
  cpus?: number;
  /** Custom memory in MB instead of a size. */
  memoryMb?: number;
  /** 2, 5 or 10 (default 10, included in the price). */
  diskGb?: number;
  /** 0-1440; default 60; 0 = never pause on idle. */
  autoStopMinutes?: number;
  env?: Record<string, string>;
  /** Clone a GitHub repository ("owner/repo") into /workspace. */
  sourceRepository?: string;
  teamId?: string;
}

export interface SandboxExecOptions {
  /** Directory to run in (default /workspace). */
  workdir?: string;
  /** At most 300. */
  timeoutSeconds?: number;
  /** Stream output as it is produced (NDJSON). Called once per output chunk. */
  onOutput?: (chunk: string) => void;
  signal?: AbortSignal;
}

export interface SandboxExecResult {
  exitCode: number;
  output: string;
  timedOut: boolean;
  truncated?: boolean;
  durationMs?: number;
}

export interface SandboxFileEntry {
  path: string;
  name: string;
  type: "file" | "directory" | (string & {});
  size?: number;
  depth?: number;
}

export interface SandboxFile {
  path: string;
  content: string;
  [key: string]: unknown;
}

export interface SandboxPricingSize {
  id: SandboxSize;
  label: string;
  cpus: number;
  memoryMb: number;
  hourlyUsd: number;
}

export interface SandboxPlanLimits {
  maxRunning: number;
  maxTotal: number;
  maxCpus: number;
  maxMemoryMb: number;
}

export interface SandboxPricing {
  currency: string;
  vcpuHourUsd: number;
  gbHourUsd: number;
  diskIncludedGb: number;
  diskOptionsGb: number[];
  minimumBalanceUsd: number;
  billing: "per_second" | (string & {});
  sizes: SandboxPricingSize[];
  templates: Array<{ id: SandboxTemplate; label: string; description?: string }>;
  plans: Record<string, SandboxPlanLimits>;
}

export interface SandboxAccountUsage {
  monthToDateUsd: number;
  runningCount: number;
  hourlyBurnUsd: number;
}

export interface SandboxUsage {
  hourlyUsd: number;
  billedUsd: number;
  unbilledUsd: number;
  ledger: Array<{ startedAt: string; endedAt?: string | null; seconds: number; amountUsd: number }>;
}

export interface SandboxLogs {
  events: Array<Record<string, unknown>>;
  logs: string;
}

export interface SandboxTerminalTicket {
  wsUrl: string;
  ticket?: string;
  expiresIn?: number;
  sessionId?: string;
  [key: string]: unknown;
}

/** waitUntilReady() saw the sandbox fail, or gave up waiting. */
export class SandboxError extends Error {
  constructor(message: string, readonly sandbox: SandboxInfo) {
    super(message);
    this.name = "SandboxError";
  }
}

const enc = encodeURIComponent;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** True for every paused state, including the legacy names. */
export function isSandboxPaused(status: string | undefined): boolean {
  return !!status && (status.startsWith("paused") || status === "stopped");
}

/** The low-level sandbox API. `pxxl.sandboxes.create()` and `get()` return a `Sandbox` handle. */
export class PxxlSandboxes {
  constructor(private readonly client: PxxlClient, private readonly defaultTeamId?: string) {}

  /** @internal */
  path(suffix = "", teamId = this.defaultTeamId) {
    const query = teamId ? `${suffix.includes("?") ? "&" : "?"}teamId=${enc(teamId)}` : "";
    return `/sandboxes${suffix}${query}`;
  }

  private call<T>(method: string, suffix: string, body?: unknown, teamId?: string) {
    return this.client.request<T>(this.path(suffix, teamId), { method, body: body === undefined ? undefined : JSON.stringify(body) });
  }

  /** Create a sandbox. It starts as `creating`; `await sandbox.waitUntilReady()` for `running`. */
  async create(options: CreateSandboxOptions = {}): Promise<Sandbox> {
    const { teamId, ...body } = options;
    const result = await this.call<{ sandbox: SandboxInfo }>("POST", "", body, teamId);
    return new Sandbox(this, result.sandbox, teamId ?? this.defaultTeamId);
  }

  /** Your sandboxes, month-to-date spend and the current rates. */
  async list(input: { teamId?: string } = {}): Promise<{ sandboxes: Sandbox[]; usage: SandboxAccountUsage; pricing?: SandboxPricing }> {
    const teamId = input.teamId ?? this.defaultTeamId;
    const result = await this.call<{ sandboxes?: SandboxInfo[]; usage: SandboxAccountUsage; pricing?: SandboxPricing }>("GET", "", undefined, teamId);
    return { ...result, sandboxes: (result.sandboxes || []).map((info) => new Sandbox(this, info, teamId)) };
  }

  /** A handle to an existing sandbox. */
  async get(id: string, input: { teamId?: string } = {}): Promise<Sandbox> {
    const teamId = input.teamId ?? this.defaultTeamId;
    return new Sandbox(this, await this.info(id, teamId), teamId);
  }
  connect(id: string, input: { teamId?: string } = {}) { return this.get(id, input); }

  /** Rates, sizes, templates and plan limits. Public: no API key needed. */
  pricing(): Promise<SandboxPricing> { return this.client.request<SandboxPricing>("/sandboxes/pricing"); }

  /** The sandbox's current JSON. */
  async info(id: string, teamId = this.defaultTeamId): Promise<SandboxInfo> {
    return (await this.call<{ sandbox: SandboxInfo }>("GET", `/${enc(id)}`, undefined, teamId)).sandbox;
  }
  async update(id: string, input: { name?: string; autoStopMinutes?: number }, teamId = this.defaultTeamId): Promise<SandboxInfo> {
    return (await this.call<{ sandbox: SandboxInfo }>("PATCH", `/${enc(id)}`, input, teamId)).sandbox;
  }
  async start(id: string, teamId = this.defaultTeamId): Promise<SandboxInfo | undefined> {
    return (await this.call<{ sandbox?: SandboxInfo }>("POST", `/${enc(id)}/start`, undefined, teamId)).sandbox;
  }
  async stop(id: string, teamId = this.defaultTeamId): Promise<SandboxInfo | undefined> {
    return (await this.call<{ sandbox?: SandboxInfo }>("POST", `/${enc(id)}/stop`, undefined, teamId)).sandbox;
  }
  delete(id: string, teamId = this.defaultTeamId) { return this.call<Record<string, unknown>>("DELETE", `/${enc(id)}`, undefined, teamId); }
  logs(id: string, teamId = this.defaultTeamId) { return this.call<SandboxLogs>("GET", `/${enc(id)}/logs`, undefined, teamId); }
  usage(id: string, teamId = this.defaultTeamId) { return this.call<SandboxUsage>("GET", `/${enc(id)}/usage`, undefined, teamId); }
  /** A short-lived WebSocket URL for an interactive shell (only when terminals are enabled). */
  terminalTicket(id: string, teamId = this.defaultTeamId) { return this.call<SandboxTerminalTicket>("POST", `/${enc(id)}/terminal/ticket`, undefined, teamId); }

  async listFiles(id: string, path?: string, teamId = this.defaultTeamId): Promise<SandboxFileEntry[]> {
    const result = await this.call<{ files?: SandboxFileEntry[] }>("GET", `/${enc(id)}/files${path ? `?path=${enc(path)}` : ""}`, undefined, teamId);
    return result.files || [];
  }
  readFile(id: string, path: string, teamId = this.defaultTeamId) {
    return this.call<SandboxFile>("GET", `/${enc(id)}/file?path=${enc(path)}`, undefined, teamId);
  }
  /** Write a text file (up to 2 MB). Parent directories are created. */
  writeFile(id: string, path: string, content: string, teamId = this.defaultTeamId) {
    return this.call<Record<string, unknown>>("PUT", `/${enc(id)}/file`, { path, content }, teamId);
  }

  /**
   * Run a shell command. With `onOutput`, output streams as it is produced
   * (NDJSON); without it the call returns once the command ends.
   */
  async exec(id: string, command: string, options: SandboxExecOptions = {}, teamId = this.defaultTeamId): Promise<SandboxExecResult> {
    const body = JSON.stringify({ command, workdir: options.workdir, timeoutSeconds: options.timeoutSeconds });
    const path = this.path(`/${enc(id)}/exec`, teamId);
    if (!options.onOutput) return this.client.request<SandboxExecResult>(path, { method: "POST", body, signal: options.signal });

    const response = await this.client.rawRequest(path, { method: "POST", body, signal: options.signal, headers: { Accept: "application/x-ndjson" } });
    const type = response.headers.get("Content-Type") || "";
    if (!/ndjson|jsonl|stream/i.test(type) || !response.body) {
      // The Gateway answered in plain JSON: hand the whole output over at once.
      const result = (await response.json()) as SandboxExecResult;
      if (result.output) options.onOutput(result.output);
      return result;
    }
    return readExecStream(response.body, options.onOutput);
  }
}

async function readExecStream(body: ReadableStream<Uint8Array>, onOutput: (chunk: string) => void): Promise<SandboxExecResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let output = "";
  const handle = (line: string): SandboxExecResult | undefined => {
    if (!line.trim()) return undefined;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return undefined;
    }
    if (event.type === "output") {
      const data = String(event.data ?? "");
      output += data;
      onOutput(data);
      return undefined;
    }
    if (event.type === "exit") {
      return {
        exitCode: Number(event.exitCode ?? 0),
        output: typeof event.output === "string" ? event.output : output,
        timedOut: Boolean(event.timedOut),
        truncated: Boolean(event.truncated),
        durationMs: typeof event.durationMs === "number" ? event.durationMs : undefined,
      };
    }
    if (event.type === "error") throw new PxxlAPIError(String(event.message || "The command failed in the sandbox"), 502, event);
    return undefined;
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buffered += decoder.decode(value, { stream: true });
      if (done) buffered += decoder.decode();
      let newline = buffered.indexOf("\n");
      while (newline >= 0) {
        const result = handle(buffered.slice(0, newline));
        buffered = buffered.slice(newline + 1);
        if (result) return result;
        newline = buffered.indexOf("\n");
      }
      if (done) {
        const result = handle(buffered);
        if (result) return result;
        throw new PxxlAPIError("The sandbox closed the output stream before the command finished", 502, { output });
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

/** One sandbox. Fields reflect the last fetch; call `refresh()` for fresh ones. */
export class Sandbox {
  private data: SandboxInfo;

  constructor(private readonly api: PxxlSandboxes, info: SandboxInfo, readonly teamId?: string) {
    this.data = info;
  }

  get info(): SandboxInfo { return this.data; }
  get id(): string { return this.data.id; }
  get name(): string { return this.data.name; }
  get status(): SandboxStatus { return this.data.status; }
  get template(): SandboxTemplate { return this.data.template; }
  get domain(): string | undefined { return this.data.domain || undefined; }
  /** The public URL of the app on $PORT (3000) inside the sandbox. */
  get previewUrl(): string | undefined {
    return this.data.previewUrl || (this.data.domain ? `https://${this.data.domain}` : undefined);
  }
  get hourlyUsd(): number { return this.data.hourlyUsd; }
  get isRunning(): boolean { return this.data.status === "running"; }
  get isPaused(): boolean { return isSandboxPaused(this.data.status); }

  /** The preview URL, fetching the sandbox once if it is not known yet. */
  async getPreviewUrl(): Promise<string | undefined> {
    if (!this.previewUrl) await this.refresh();
    return this.previewUrl;
  }

  /** Fetch the latest status and fields. */
  async refresh(): Promise<this> {
    this.data = await this.api.info(this.id, this.teamId);
    return this;
  }

  /** Poll until the sandbox is running. Throws SandboxError if it fails or `timeoutMs` passes (default 3 min). */
  async waitUntilReady(options: { timeoutMs?: number; intervalMs?: number } = {}): Promise<this> {
    const until = Date.now() + (options.timeoutMs ?? 180_000);
    const interval = options.intervalMs ?? 2000;
    for (;;) {
      if (this.status === "running") return this;
      if (this.status === "failed") throw new SandboxError(`Sandbox ${this.name || this.id} failed to start`, this.data);
      if (Date.now() >= until) throw new SandboxError(`Sandbox ${this.name || this.id} is still ${this.status}; gave up waiting`, this.data);
      await sleep(interval);
      await this.refresh();
    }
  }

  exec(command: string, options: SandboxExecOptions = {}) { return this.api.exec(this.id, command, options, this.teamId); }

  readonly files = {
    /** The text content of a file. */
    read: async (path: string): Promise<string> => (await this.api.readFile(this.id, path, this.teamId)).content,
    /** The file with its metadata. */
    get: (path: string) => this.api.readFile(this.id, path, this.teamId),
    /** Write a text file (up to 2 MB). */
    write: (path: string, content: string) => this.api.writeFile(this.id, path, content, this.teamId),
    /** Files under `path` (default /workspace). */
    list: (path?: string) => this.api.listFiles(this.id, path, this.teamId),
  };

  /** Start or resume. Needs a wallet balance of at least $0.25. */
  async start(): Promise<this> {
    const info = await this.api.start(this.id, this.teamId);
    if (info) this.data = info;
    else await this.refresh();
    return this;
  }
  resume() { return this.start(); }
  /** Pause. /workspace is kept and billing stops. */
  async stop(): Promise<this> {
    const info = await this.api.stop(this.id, this.teamId);
    if (info) this.data = info;
    else await this.refresh();
    return this;
  }
  pause() { return this.stop(); }
  /** Delete the sandbox and its /workspace. Cannot be undone. */
  delete() { return this.api.delete(this.id, this.teamId); }

  async update(input: { name?: string; autoStopMinutes?: number }): Promise<this> {
    this.data = await this.api.update(this.id, input, this.teamId);
    return this;
  }
  /** Pause after this many idle minutes (0-1440; 0 = never). */
  setAutoStop(minutes: number) { return this.update({ autoStopMinutes: minutes }); }
  usage() { return this.api.usage(this.id, this.teamId); }
  logs() { return this.api.logs(this.id, this.teamId); }
  terminalTicket() { return this.api.terminalTicket(this.id, this.teamId); }

  toJSON() { return this.data; }
}
