import { PxxlAPIError, type PxxlClient } from "./index.js";

/**
 * Sandboxes: isolated Linux workspaces you create, run commands in and throw
 * away. Billed per second from your USD wallet while running, $0 while paused.
 * Paid plans only (Plus and up). Use an API key scoped to `all` or `sandbox`.
 *
 *   const sandbox = await pxxl.sandboxes.create({ template: "node", size: "small", labels: { team: "payments" } });
 *   await sandbox.waitUntilReady();
 *   const { exitCode, output } = await sandbox.exec("node --version");
 *   const snapshot = await sandbox.snapshot({ name: "deps-installed" });
 *   const copy = await pxxl.sandboxes.create({ snapshotId: snapshot.id });
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
/**
 * base (Debian 13, the default), node, python, go, rust or bun. Aliases:
 * nodejs, js and typescript mean node; py means python; golang means go.
 */
export type SandboxTemplate = "base" | "node" | "python" | "go" | "rust" | "bun" | (string & {});
/** Labels: up to 20 `key: value` pairs. Keys match ^[a-z0-9][a-z0-9_.-]{0,62}$; values are one line, up to 256 characters. */
export type SandboxLabels = Record<string, string>;
/** A label filter for list(): every pair must match. `true` matches any value of that key. */
export type SandboxLabelFilter = Record<string, string | true>;
export type SandboxSignal = "TERM" | "KILL" | "INT" | "HUP";
export type SandboxSize = "micro" | "small" | "medium" | "large" | (string & {});

/**
 * Outbound network policy. allow-all: the public internet (the default).
 * deny-all: no outbound connections, DNS refused. allowlist: only the
 * domains and public IPv4 addresses/CIDRs in `allow`.
 */
export type SandboxEgressMode = "allow-all" | "deny-all" | "allowlist";
/** A sandbox's egress (outbound network) policy, as the API returns it. */
export interface SandboxEgress {
  mode: SandboxEgressMode;
  /**
   * Up to 64 entries: `github.com` (exact), `*.npmjs.org` (any subdomain),
   * or a public IPv4 address/CIDR like `140.82.112.0/20`.
   */
  allow: string[];
}
/**
 * A policy to set. `mode` may be left out when `allow` has entries (that
 * means allowlist); `{ mode: "allow-all" }` and `{ mode: "deny-all" }` need no list.
 */
export type EgressPolicy = { mode?: SandboxEgressMode; allow?: string[] };
/** What setNetwork() returns. `egressApplied: false` means it applies at the next start. */
export interface SandboxNetworkResult {
  sandbox: SandboxInfo;
  egressApplied: boolean;
  /** Set when the change waits for the next start. */
  message?: string;
}

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
  labels?: SandboxLabels;
  /** Outbound network policy. */
  egress?: SandboxEgress;
  [key: string]: unknown;
}

export interface CreateSandboxOptions {
  name?: string;
  /** base (Debian 13, the default), node, python, go, rust or bun. */
  template?: SandboxTemplate;
  /** micro (1 vCPU, 1 GB), small (2, 4 GB), medium (4, 8 GB) or large (8, 16 GB). */
  size?: SandboxSize;
  /** Custom vCPUs instead of a size. */
  cpus?: number;
  /** Custom memory in MB instead of a size. */
  memoryMb?: number;
  /** 2, 5 or 10 GB (default 5; up to 10 included in the price). */
  diskGb?: number;
  /** "public" (default): anyone with the preview URL. "private": only links from previewLink(). */
  previewAccess?: "public" | "private";
  /** 0-1440; default 60; 0 = never pause on idle. */
  autoStopMinutes?: number;
  env?: Record<string, string>;
  /** Clone a GitHub repository ("owner/repo") into /workspace. */
  sourceRepository?: string;
  /** Up to 20 `key: value` labels to find the sandbox by later. */
  labels?: SandboxLabels;
  /** Outbound network policy; omitted means allow-all. `{ allow: [...] }` is an allowlist. */
  egress?: EgressPolicy;
  /**
   * Start from a snapshot: its home directory and /workspace come back. The
   * template comes from the snapshot, so leave `template` out.
   */
  snapshotId?: string;
  teamId?: string;
}

export type SandboxSnapshotStatus = "creating" | "ready" | "failed" | (string & {});

/**
 * A saved copy of a sandbox's home directory (global installs, dotfiles) and
 * /workspace. Memory and running processes are not kept. Saving takes about
 * 5-15 seconds.
 */
export interface SandboxSnapshot {
  id: string;
  name: string;
  template: SandboxTemplate;
  /** The template's runtime version when the snapshot was taken. */
  version?: string;
  status: SandboxSnapshotStatus;
  /** Why saving failed, when `status` is "failed". */
  error?: string | null;
  sizeBytes?: number;
  sizeMb?: number;
  sourceSandboxId?: string;
  cpus?: number;
  memoryMb?: number;
  volumeLimitMb?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface SnapshotWaitOptions {
  /** Give up after this long (default 5 min). */
  timeoutMs?: number;
  /** Poll every this many ms (default 2000). */
  intervalMs?: number;
}

export interface CreateSnapshotOptions extends SnapshotWaitOptions {
  name?: string;
  /** Poll until the snapshot is ready (default true). `false` returns it while still `creating`. */
  wait?: boolean;
}

export interface UpdateSandboxOptions {
  name?: string;
  autoStopMinutes?: number;
  previewAccess?: "public" | "private";
  /** Replaces all labels; `{}` clears them. */
  labels?: SandboxLabels;
  /** Replaces the outbound network policy. Use setNetwork() to learn whether it applied right away. */
  egress?: EgressPolicy;
}

/** One process inside the sandbox, from `ps`. */
export interface SandboxProcess {
  pid: number;
  ppid: number;
  elapsedSeconds: number;
  cpuPercent: number;
  memoryKb: number;
  command: string;
}

export interface SandboxExecOptions {
  /** Directory to run in (default /workspace). */
  workdir?: string;
  /** At most 300. */
  timeoutSeconds?: number;
  /** Stream output as it is produced (NDJSON). Called once per output chunk. */
  onOutput?: (chunk: string) => void;
  /** Start detached (a dev server, a watcher) and return at once with its pid and log file. */
  background?: boolean;
  signal?: AbortSignal;
}

export interface SandboxExecResult {
  /** Set for background commands: the process and where its output goes. */
  background?: boolean;
  pid?: number;
  logFile?: string;
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
  /** Text, or base64 when `encoding` is "base64". */
  content: string;
  encoding?: "base64" | (string & {});
  [key: string]: unknown;
}

export interface SandboxTemplateInfo {
  id: SandboxTemplate;
  label: string;
  description?: string;
  /** The runtime version in the image (e.g. "26.13.1" for node). */
  version?: string;
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
  templates: SandboxTemplateInfo[];
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
export type SandboxHint = { kind: "idle" | "runway" | string; sandboxId?: string; message: string; action?: "stop" | "top_up" | string };

export type SandboxSummary = {
  total: number; running: number; paused: number;
  hourlyBurnUsd: number; unbilledUsd: number; monthToDateUsd: number;
  vcpuHoursMonth: number; gbHoursMonth: number; storageGb: number;
  walletUsd: number; runwayHours: number | null;
  daily: { date: string; spendUsd: number }[];
  recent: SandboxInfo[];
  hints: SandboxHint[];
};

export type SandboxAnalytics = { success?: boolean; sandboxId: string; domain: string; timeframe: string; data: Record<string, unknown> };

/** A snapshot failed to save, or waiting for it gave up. */
export class SandboxSnapshotError extends Error {
  constructor(message: string, readonly snapshot: SandboxSnapshot) {
    super(message);
    this.name = "SandboxSnapshotError";
  }
}

export class SandboxError extends Error {
  constructor(message: string, readonly sandbox: SandboxInfo) {
    super(message);
    this.name = "SandboxError";
  }
}

const enc = encodeURIComponent;

type Bytes = Uint8Array;
const NodeBuffer = (globalThis as { Buffer?: { from(input: string | Uint8Array, encoding?: string): Uint8Array & { toString(encoding?: string): string } } }).Buffer;

/** @internal */
export function bytesToBase64(bytes: Bytes): string {
  if (NodeBuffer) return NodeBuffer.from(bytes).toString("base64");
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

/** @internal A Buffer in Node, a Uint8Array elsewhere. */
export function base64ToBytes(value: string): Bytes {
  if (NodeBuffer) return NodeBuffer.from(value, "base64");
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** `label=key:value` query parameters (AND). */
function labelQuery(labels?: SandboxLabelFilter): string {
  return Object.entries(labels || {}).map(([key, value]) => `label=${enc(value === true ? key : `${key}:${value}`)}`).join("&");
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** True for every paused state, including the legacy names. */
export function isSandboxPaused(status: string | undefined): boolean {
  return !!status && (status.startsWith("paused") || status === "stopped");
}

/** The low-level sandbox API. `pxxl.sandboxes.create()` and `get()` return a `Sandbox` handle. */
export class PxxlSandboxes {
  /** Saved sandboxes to start new ones from. */
  readonly snapshots: PxxlSandboxSnapshots;

  constructor(private readonly client: PxxlClient, private readonly defaultTeamId?: string) {
    this.snapshots = new PxxlSandboxSnapshots(client, this, defaultTeamId);
  }

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

  /**
   * Your sandboxes, month-to-date spend and the current rates. `labels`
   * keeps only sandboxes with every given label (`true` matches any value).
   */
  async list(input: { teamId?: string; labels?: SandboxLabelFilter } = {}): Promise<{ sandboxes: Sandbox[]; usage: SandboxAccountUsage; pricing?: SandboxPricing }> {
    const teamId = input.teamId ?? this.defaultTeamId;
    const query = labelQuery(input.labels);
    const result = await this.call<{ sandboxes?: SandboxInfo[]; usage: SandboxAccountUsage; pricing?: SandboxPricing }>("GET", query ? `?${query}` : "", undefined, teamId);
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
  /** The templates with their runtime versions. Public: no API key needed. */
  async templates(): Promise<SandboxTemplateInfo[]> { return (await this.pricing()).templates || []; }

  /**
   * The account at a glance: running and paused counts, $/hour now, spend,
   * vCPU-hours and GB-hours this month, reserved storage, wallet runway and
   * hints (idle sandboxes worth stopping, a wallet about to run out).
   */
  async summary(input: { teamId?: string } = {}): Promise<SandboxSummary> {
    return (await this.call<{ data: SandboxSummary }>("GET", "/summary", undefined, input.teamId ?? this.defaultTeamId)).data;
  }

  /** The sandbox's current JSON. */
  async info(id: string, teamId = this.defaultTeamId): Promise<SandboxInfo> {
    return (await this.call<{ sandbox: SandboxInfo }>("GET", `/${enc(id)}`, undefined, teamId)).sandbox;
  }
  /** The URL to open the preview. For a private preview it carries a 12-hour token. */
  previewLink(id: string, teamId = this.defaultTeamId) {
    return this.call<{ url: string; access: "public" | "private"; expiresAt?: string }>("POST", `/${enc(id)}/preview-link`, undefined, teamId);
  }
  /** Change the name, auto-stop, preview access or labels (`labels` replaces them all). */
  async update(id: string, input: UpdateSandboxOptions, teamId = this.defaultTeamId): Promise<SandboxInfo> {
    return (await this.call<{ sandbox: SandboxInfo }>("PATCH", `/${enc(id)}`, input, teamId)).sandbox;
  }
  /**
   * Change the outbound network policy. New connections follow it at once;
   * open ones are not cut. `egressApplied: false` (with a `message`) means it
   * applies at the next start. 400 for invalid entries, 409 when the server
   * cannot enforce policies.
   */
  async setNetwork(id: string, egress: EgressPolicy, teamId = this.defaultTeamId): Promise<SandboxNetworkResult> {
    const result = await this.call<{ sandbox: SandboxInfo; egressApplied?: boolean; message?: string }>("PATCH", `/${enc(id)}`, { egress }, teamId);
    return { sandbox: result.sandbox, egressApplied: result.egressApplied !== false, ...(result.message ? { message: result.message } : {}) };
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
  /** Preview URL traffic (requests, visitors, bandwidth) for 24h, 7d or 30d. */
  analytics(id: string, timeframe: "24h" | "7d" | "30d" = "24h", teamId = this.defaultTeamId) {
    return this.call<SandboxAnalytics>("GET", `/${enc(id)}/analytics?timeframe=${timeframe}`, undefined, teamId);
  }
  /** A short-lived WebSocket URL for an interactive shell (only when terminals are enabled). */
  terminalTicket(id: string, teamId = this.defaultTeamId) { return this.call<SandboxTerminalTicket>("POST", `/${enc(id)}/terminal/ticket`, undefined, teamId); }

  async listFiles(id: string, path?: string, teamId = this.defaultTeamId): Promise<SandboxFileEntry[]> {
    const result = await this.call<{ files?: SandboxFileEntry[] }>("GET", `/${enc(id)}/files${path ? `?path=${enc(path)}` : ""}`, undefined, teamId);
    return result.files || [];
  }
  /** A file. With `{ encoding: "base64" }` the content comes back base64-encoded (binary-safe). */
  readFile(id: string, path: string, options: { encoding?: "base64" } = {}, teamId = this.defaultTeamId) {
    return this.call<SandboxFile>("GET", `/${enc(id)}/file?path=${enc(path)}${options.encoding ? `&encoding=${options.encoding}` : ""}`, undefined, teamId);
  }
  /** Write a file (up to 2 MB). A string is written as text; bytes go base64-encoded. Parent directories are created. */
  writeFile(id: string, path: string, content: string | Uint8Array, teamId = this.defaultTeamId) {
    const body = typeof content === "string" ? { path, content } : { path, content: bytesToBase64(content), encoding: "base64" };
    return this.call<Record<string, unknown>>("PUT", `/${enc(id)}/file`, body, teamId);
  }

  /** Processes running in the sandbox. */
  async processes(id: string, teamId = this.defaultTeamId): Promise<SandboxProcess[]> {
    return (await this.call<{ processes?: SandboxProcess[] }>("GET", `/${enc(id)}/processes`, undefined, teamId)).processes || [];
  }
  /** Signal a process (TERM by default). A 404 means no such process. */
  kill(id: string, pid: number, signal: SandboxSignal = "TERM", teamId = this.defaultTeamId) {
    return this.call<{ pid: number; signal: string }>("DELETE", `/${enc(id)}/processes/${enc(String(pid))}?signal=${enc(signal)}`, undefined, teamId);
  }

  /**
   * Run a shell command. With `onOutput`, output streams as it is produced
   * (NDJSON); without it the call returns once the command ends.
   */
  async exec(id: string, command: string, options: SandboxExecOptions = {}, teamId = this.defaultTeamId): Promise<SandboxExecResult> {
    const body = JSON.stringify({ command, workdir: options.workdir, timeoutSeconds: options.timeoutSeconds, background: options.background || undefined });
    const path = this.path(`/${enc(id)}/exec`, teamId);
    if (options.background) {
      const started = await this.client.request<{ background: boolean; pid: number; logFile: string }>(path, { method: "POST", body, signal: options.signal });
      return { ...started, exitCode: 0, output: "", timedOut: false };
    }
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

/**
 * Snapshots: `pxxl.sandboxes.snapshots`. Take one with `sandbox.snapshot()`,
 * start from one with `pxxl.sandboxes.create({ snapshotId })`. Plus keeps 5,
 * Pro 25, Enterprise 100.
 */
export class PxxlSandboxSnapshots {
  constructor(private readonly client: PxxlClient, private readonly sandboxes: PxxlSandboxes, private readonly defaultTeamId?: string) {}

  private call<T>(method: string, suffix: string, body: unknown, teamId: string | undefined) {
    return this.client.request<T>(this.sandboxes.path(suffix, teamId ?? this.defaultTeamId), { method, body: body === undefined ? undefined : JSON.stringify(body) });
  }

  /** Your snapshots, newest first; `sandboxId` keeps those taken from one sandbox. */
  async list(input: { sandboxId?: string; teamId?: string } = {}): Promise<SandboxSnapshot[]> {
    const query = input.sandboxId ? `?sandboxId=${enc(input.sandboxId)}` : "";
    return (await this.call<{ snapshots?: SandboxSnapshot[] }>("GET", `/snapshots${query}`, undefined, input.teamId)).snapshots || [];
  }

  async get(id: string, input: { teamId?: string } = {}): Promise<SandboxSnapshot> {
    return (await this.call<{ snapshot: SandboxSnapshot }>("GET", `/snapshots/${enc(id)}`, undefined, input.teamId)).snapshot;
  }

  /**
   * Delete a snapshot. 409 while sandboxes still use it (the error's
   * `details.sandboxIds` lists them) or while it is still saving.
   */
  delete(id: string, input: { teamId?: string } = {}) {
    return this.call<Record<string, unknown>>("DELETE", `/snapshots/${enc(id)}`, undefined, input.teamId);
  }

  /**
   * Snapshot a running sandbox (409 when it is not running, 403 over the plan's
   * limit). Waits until the snapshot is ready unless `wait: false`; throws
   * SandboxSnapshotError if saving fails.
   */
  async create(sandboxId: string, options: CreateSnapshotOptions & { teamId?: string } = {}): Promise<SandboxSnapshot> {
    const { name, wait = true, timeoutMs, intervalMs, teamId } = options;
    const { snapshot } = await this.call<{ snapshot: SandboxSnapshot }>("POST", `/${enc(sandboxId)}/snapshots`, name === undefined ? {} : { name }, teamId);
    return wait ? this.waitUntilReady(snapshot, { timeoutMs, intervalMs, teamId }) : snapshot;
  }

  /** Poll until the snapshot is ready. Throws SandboxSnapshotError when it fails or `timeoutMs` passes (default 5 min). */
  async waitUntilReady(snapshot: SandboxSnapshot | string, options: SnapshotWaitOptions & { teamId?: string } = {}): Promise<SandboxSnapshot> {
    let current = typeof snapshot === "string" ? await this.get(snapshot, { teamId: options.teamId }) : snapshot;
    const until = Date.now() + (options.timeoutMs ?? 300_000);
    const interval = options.intervalMs ?? 2000;
    for (;;) {
      if (current.status === "ready") return current;
      if (current.status === "failed") throw new SandboxSnapshotError(`Snapshot ${current.name || current.id} failed${current.error ? `: ${current.error}` : ""}`, current);
      if (Date.now() >= until) throw new SandboxSnapshotError(`Snapshot ${current.name || current.id} is still ${current.status}; gave up waiting`, current);
      await sleep(interval);
      current = await this.get(current.id, { teamId: options.teamId });
    }
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
  get labels(): SandboxLabels { return this.data.labels || {}; }
  /** The outbound network policy (allow-all when the API did not say). */
  get egress(): SandboxEgress { return this.data.egress || { mode: "allow-all", allow: [] }; }
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

  readonly files: {
    /** The text content of a file; with `{ binary: true }` its bytes (a Buffer in Node). */
    read(path: string): Promise<string>;
    read(path: string, options: { binary: true }): Promise<Uint8Array>;
    read(path: string, options?: { binary?: boolean }): Promise<string | Uint8Array>;
    /** The file with its metadata. */
    get(path: string, options?: { encoding?: "base64" }): Promise<SandboxFile>;
    /** Write a file (up to 2 MB): a string as text, a Uint8Array or Buffer as bytes. */
    write(path: string, content: string | Uint8Array): Promise<Record<string, unknown>>;
    /** Files under `path` (default /workspace). */
    list(path?: string): Promise<SandboxFileEntry[]>;
  } = {
    read: (async (path: string, options: { binary?: boolean } = {}) => {
      if (!options.binary) return (await this.api.readFile(this.id, path, {}, this.teamId)).content;
      return base64ToBytes((await this.api.readFile(this.id, path, { encoding: "base64" }, this.teamId)).content || "");
    }) as never,
    get: (path: string, options: { encoding?: "base64" } = {}) => this.api.readFile(this.id, path, options, this.teamId),
    write: (path: string, content: string | Uint8Array) => this.api.writeFile(this.id, path, content, this.teamId),
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

  /** A link that opens the preview (with a 12-hour token when the preview is private). */
  previewLink() { return this.api.previewLink(this.id, this.teamId); }
  /** Make the preview URL public or private. */
  setPreviewAccess(access: "public" | "private") { return this.update({ previewAccess: access }); }
  async update(input: UpdateSandboxOptions): Promise<this> {
    this.data = await this.api.update(this.id, input, this.teamId);
    return this;
  }
  /** Pause after this many idle minutes (0-1440; 0 = never). */
  setAutoStop(minutes: number) { return this.update({ autoStopMinutes: minutes }); }
  /** Replace the labels (`{}` clears them). */
  setLabels(labels: SandboxLabels) { return this.update({ labels }); }
  /**
   * Change the outbound network policy: `{ mode: "deny-all" }`,
   * `{ allow: ["github.com", "*.npmjs.org"] }` or `{ mode: "allow-all" }`.
   * `egressApplied: false` means it applies at the next start.
   */
  async setNetwork(policy: EgressPolicy): Promise<SandboxNetworkResult> {
    const result = await this.api.setNetwork(this.id, policy, this.teamId);
    if (result.sandbox) this.data = result.sandbox;
    return result;
  }
  /**
   * Save the home directory and /workspace as a snapshot (the sandbox must be
   * running). Waits until it is ready unless `wait: false`; throws
   * SandboxSnapshotError if saving fails. Start from it with
   * `pxxl.sandboxes.create({ snapshotId })`.
   */
  snapshot(options: CreateSnapshotOptions = {}): Promise<SandboxSnapshot> {
    return this.api.snapshots.create(this.id, { ...options, teamId: this.teamId });
  }
  /** Snapshots taken from this sandbox. */
  snapshots() { return this.api.snapshots.list({ sandboxId: this.id, teamId: this.teamId }); }
  /** Processes running in the sandbox (pid, ppid, elapsed seconds, CPU %, memory, command). */
  processes() { return this.api.processes(this.id, this.teamId); }
  /** Signal a process (TERM by default; KILL, INT or HUP). */
  kill(pid: number, signal: SandboxSignal = "TERM") { return this.api.kill(this.id, pid, signal, this.teamId); }
  usage() { return this.api.usage(this.id, this.teamId); }
  analytics(timeframe: "24h" | "7d" | "30d" = "24h") { return this.api.analytics(this.id, timeframe, this.teamId); }
  logs() { return this.api.logs(this.id, this.teamId); }
  terminalTicket() { return this.api.terminalTicket(this.id, this.teamId); }

  toJSON() { return this.data; }
}
