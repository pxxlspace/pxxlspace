import { access, readFile, readdir, writeFile, mkdir, copyFile, chmod, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, basename } from "node:path";
import { zipSync } from "fflate";
import ignore from "ignore";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";

export type CDNVisibility = "private" | "public";
export type CDNAssetKind = "file" | "artifact";

export interface PxxlClientOptions {
  apiKey?: string;
  baseUrl?: string;
  teamId?: string;
  fetchImpl?: typeof fetch;
}

export interface CDNAsset {
  id: string;
  userId: string;
  projectId?: string | null;
  deploymentId?: string | null;
  storageName?: string;
  key: string;
  fileName: string;
  contentType?: string;
  size: number;
  publicUrl?: string;
  sha256?: string;
  etag?: string;
  visibility: CDNVisibility;
  kind: CDNAssetKind | string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface CDNSummary {
  totalFiles: number;
  storageBytes: number;
  uploadedBytes: number;
  downloadedBytes: number;
  uploadsLast24h: number;
  recentAssets: CDNAsset[];
  configured: boolean;
  storageName: string;
}

export interface UploadAssetInput {
  file: Blob;
  fileName: string;
  visibility?: CDNVisibility;
  kind?: CDNAssetKind;
  projectId?: string;
  deploymentId?: string;
}

export interface ListAssetsInput {
  page?: number;
  limit?: number;
  search?: string;
  kind?: CDNAssetKind;
}

export interface DomainTLD {
  id?: number;
  tld: string;
  usage?: string;
  registerDollar?: number;
  registerNaira?: number;
  renewDollar?: number;
  renewNaira?: number;
  transferDollar?: number;
  transferNaira?: number;
  restoreDollar?: number;
  restoreNaira?: number;
  bonusAmount?: number;
  bonusAmountUsd?: number;
  bonusEndingDate?: string | null;
  minimumPeriod?: number;
  maxDuration?: number;
  privacy?: string;
  idn?: string;
  restrictions?: string;
}

export interface DomainSearchResult {
  domain: string;
  available: boolean;
  isPremium: boolean;
  purchaseType?: string;
  reason?: string;
  provider?: string;
  tld: string;
  usage?: string;
  registerDollar?: number;
  registerNaira?: number;
  renewDollar?: number;
  renewNaira?: number;
  transferDollar?: number;
  transferNaira?: number;
  bonusAmount?: number;
  bonusAmountUSD?: number;
  bonusEndingDate?: string | null;
  minimumPeriod?: number;
  maxDuration?: number;
  privacy?: string;
  idn?: string;
  restrictions?: string;
}

export interface DomainSearchInput {
  query: string;
  type?: string;
}

export interface TeamSummary {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  ownerId?: string;
  status?: string;
  myRole?: string;
  totalMembers?: number;
  totalProjects?: number;
  totalDatabases?: number;
  totalDomains?: number;
}

export interface DatabaseSummary {
  id: string;
  name: string;
  actualDatabaseName?: string;
  type: string;
  description?: string | null;
  status: string;
  dbUser?: string | null;
  dbName?: string | null;
  externalUrl?: string | null;
  port?: number | null;
  proxyHost?: string | null;
  proxyPort?: number | null;
  routeKey?: string | null;
  projectId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDatabaseInput {
  name: string;
  type: "postgres" | "postgresql" | "clickhouse" | "dragonfly" | "redis" | "keydb" | "mariadb" | "mysql" | "mongodb" | string;
  description?: string;
  projectId?: string;
  dailyBackupsEnabled?: boolean;
  teamId?: string;
}

export interface UpdateDatabaseInput {
  name?: string;
  description?: string;
  teamId?: string;
}

export interface DeployConfig {
  name?: string;
  domainChoice?: string;
  environment?: string;
  deployEnvironment?: string;
  port?: number;
  language?: string;
  framework?: string;
  packageManager?: string;
  installCommand?: string;
  buildCommand?: string;
  startCommand?: string;
  baseDirectory?: string;
  entryFile?: string;
}

export interface BoilerplateManifest extends DeployConfig {
  id: string;
  name?: string;
  description?: string;
}

export interface DeployInput extends DeployConfig {
  cwd?: string;
  archivePath?: string;
}

export class PxxlAPIError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "PxxlAPIError";
    this.status = status;
    this.details = details;
  }
}

export class PxxlClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly teamId?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PxxlClientOptions = {}) {
    this.apiKey = (options.apiKey || "").trim() || undefined;
    this.baseUrl = (options.baseUrl || "https://gateway.pxxl.app/api/v3").replace(/\/+$/, "");
    this.teamId = (options.teamId || "").trim() || undefined;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async whoami(): Promise<unknown> {
    return this.request("/me");
  }

  async summary(): Promise<CDNSummary> {
    const response = await this.request<{ data: CDNSummary }>("/cdn/summary");
    return response.data;
  }

  async listAssets(input: ListAssetsInput = {}): Promise<{ assets: CDNAsset[]; pagination: unknown }> {
    const params = new URLSearchParams();
    Object.entries(input).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    });
    const suffix = params.size ? `?${params.toString()}` : "";
    return this.request(`/cdn/assets${suffix}`);
  }

  async uploadAsset(input: UploadAssetInput): Promise<CDNAsset> {
    if (!input.fileName || !input.fileName.trim()) throw new Error("uploadAsset requires fileName");
    const form = new FormData();
    form.append("file", input.file, input.fileName);
    form.append("visibility", input.visibility || "public");
    if (input.kind) form.append("kind", input.kind);
    if (input.projectId) form.append("projectId", input.projectId);
    if (input.deploymentId) form.append("deploymentId", input.deploymentId);
    const response = await this.request<{ asset: CDNAsset }>("/cdn/assets", { method: "POST", body: form, skipContentType: true });
    return response.asset;
  }

  async downloadAsset(id: string): Promise<Blob> {
    const response = await this.rawRequest(`/cdn/assets/${encodeURIComponent(id)}/download`);
    return response.blob();
  }

  async deleteAsset(id: string): Promise<void> {
    await this.request(`/cdn/assets/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async usage(limit = 100): Promise<unknown[]> {
    const response = await this.request<{ events: unknown[] }>(`/cdn/usage?limit=${encodeURIComponent(limit)}`);
    return response.events;
  }

  async listTLDs(): Promise<{ tlds: DomainTLD[]; count: number }> {
    return this.request("/domains/tlds");
  }

  async popularTLDs(): Promise<{ tlds: DomainTLD[]; count: number }> {
    return this.request("/domains/tlds/popular");
  }

  async searchTLDs(q: string): Promise<{ tlds: DomainTLD[]; count: number; query: string }> {
    return this.request(`/domains/tlds/search?q=${encodeURIComponent(q)}`);
  }

  async searchDomains(input: DomainSearchInput): Promise<{ query: string; results: DomainSearchResult[]; count: number; latency?: number; cached?: boolean }> {
    return this.request("/domains/search", { method: "POST", body: JSON.stringify(input) });
  }

  async listTeams(): Promise<{ teams: TeamSummary[]; total: number }> {
    return this.request("/teams");
  }

  async getTeam(id: string): Promise<{ team: TeamSummary; success?: boolean }> {
    return this.request(`/teams/${encodeURIComponent(id)}`);
  }

  async listDatabases(teamId = this.teamId): Promise<{ databases: DatabaseSummary[]; total: number; success?: boolean }> {
    return this.request(`/databases${teamQuery(teamId)}`);
  }

  async getDatabase(id: string, teamId = this.teamId): Promise<{ database: DatabaseSummary; success?: boolean }> {
    return this.request(`/databases/${encodeURIComponent(id)}${teamQuery(teamId)}`);
  }

  async createDatabase(input: CreateDatabaseInput): Promise<{ database: DatabaseSummary; success?: boolean }> {
    const teamId = input.teamId || this.teamId;
    const body = {
      name: input.name,
      type: input.type,
      description: input.description,
      projectId: input.projectId,
      dailyBackupsEnabled: Boolean(input.dailyBackupsEnabled),
    };
    return this.request(`/databases${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify(body) });
  }

  async updateDatabase(id: string, input: UpdateDatabaseInput): Promise<{ database: DatabaseSummary; success?: boolean }> {
    return this.request(`/databases/${encodeURIComponent(id)}${teamQuery(input.teamId || this.teamId)}`, { method: "PATCH", body: JSON.stringify({ name: input.name, description: input.description }) });
  }

  async deleteDatabase(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/databases/${encodeURIComponent(id)}${teamQuery(teamId)}`, { method: "DELETE" });
  }

  async startDatabase(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/databases/${encodeURIComponent(id)}/start${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
  }

  async stopDatabase(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/databases/${encodeURIComponent(id)}/stop${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
  }

  async restartDatabase(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/databases/${encodeURIComponent(id)}/restart${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
  }

  async databaseStats(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/databases/${encodeURIComponent(id)}/stats${teamQuery(teamId)}`);
  }

  async databaseTables(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/databases/${encodeURIComponent(id)}/tables${teamQuery(teamId)}`);
  }

  async deploy(input: DeployInput): Promise<unknown> {
    const cwd = resolve(input.cwd || process.cwd());
    const config = { ...(await readPxxlToml(cwd)), ...input };
    const archive = input.archivePath ? await readFile(input.archivePath) : await createProjectZip(cwd);
    const form = new FormData();
    const archiveBytes = archive instanceof Uint8Array ? archive : new Uint8Array(archive);
    const archivePart = archiveBytes.buffer.slice(archiveBytes.byteOffset, archiveBytes.byteOffset + archiveBytes.byteLength) as ArrayBuffer;
    form.append("file", new Blob([archivePart]), basename(input.archivePath || "pxxl-source.zip"));
    form.append("name", requiredConfig(config.name, "name"));
    form.append("domainChoice", requiredConfig(config.domainChoice, "domainChoice"));
    form.append("environment", config.environment || "production");
    for (const key of ["deployEnvironment", "port", "language", "framework", "packageManager", "installCommand", "buildCommand", "startCommand", "baseDirectory", "entryFile"] as const) {
      const value = config[key];
      if (value !== undefined && value !== null && value !== "") form.append(key, String(value));
    }
    return this.request("/projects/spacedrop", { method: "POST", body: form, skipContentType: true });
  }

  private async request<T>(path: string, init: RequestInit & { skipContentType?: boolean } = {}): Promise<T> {
    const response = await this.rawRequest(path, init);
    const data = await response.json().catch(() => ({}));
    return data as T;
  }

  private async rawRequest(path: string, init: RequestInit & { skipContentType?: boolean } = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.apiKey) headers.set("Authorization", `Bearer ${this.apiKey}`);
    if (!init.skipContentType && init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      let details: unknown = null;
      try {
        details = await response.json();
      } catch {
        details = await response.text().catch(() => "");
      }
      const message = typeof details === "object" && details && "message" in details ? String((details as { message: unknown }).message) : `Pxxl request failed with ${response.status}`;
      throw new PxxlAPIError(message, response.status, details);
    }
    return response;
  }
}

export const PxxlCDN = PxxlClient;
export const PxxlCDNError = PxxlAPIError;

export const defaultPxxlIgnore = [
  ".git",
  ".git/**",
  "node_modules",
  "node_modules/**",
  ".env",
  ".env.*",
  "*.log",
  "dist",
  "dist/**",
  "build",
  "build/**",
  ".next",
  ".next/**",
  ".turbo",
  ".turbo/**",
  ".cache",
  ".cache/**",
  ".config/pxxl",
  ".config/pxxl/**",
  "pxxl-source.zip",
];

export async function createProjectZip(cwd: string): Promise<Uint8Array> {
  const root = resolve(cwd);
  const matcher = ignore().add(defaultPxxlIgnore);
  try {
    matcher.add((await readFile(join(root, ".pxxlignore"), "utf8")).split(/\r?\n/));
  } catch {
    // no local ignore file
  }
  const files: Record<string, Uint8Array> = {};
  await collectFiles(root, root, matcher, files);
  if (Object.keys(files).length === 0) throw new Error("No deployable files found after applying .pxxlignore");
  return zipSync(files, { level: 6, mtime: new Date(Date.UTC(1980, 0, 1)) });
}

async function collectFiles(root: string, dir: string, matcher: ReturnType<typeof ignore>, files: Record<string, Uint8Array>) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    const rel = relative(root, full).replace(/\\/g, "/");
    if (!rel || matcher.ignores(rel) || matcher.ignores(`${rel}/`)) continue;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      await collectFiles(root, full, matcher, files);
      continue;
    }
    if (!entry.isFile()) continue;
    if (looksSensitive(rel)) throw new Error(`Refusing to package sensitive file: ${rel}`);
    const bytes = await readFile(full);
    files[rel] = new Uint8Array(bytes);
  }
}

function looksSensitive(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".pem") || lower.endsWith(".key") || lower.includes("id_rsa") || lower.includes("service-account") || lower.includes("credentials.json");
}

export async function readPxxlToml(cwd: string): Promise<DeployConfig> {
  try {
    return parseToml(await readFile(join(cwd, "pxxl.toml"), "utf8")) as DeployConfig;
  } catch {
    return {};
  }
}

export async function writeDefaultPxxlFiles(cwd: string, config: DeployConfig) {
  await writeFile(join(cwd, "pxxl.toml"), stringifyToml(config as Record<string, unknown>));
  await writeFile(join(cwd, ".pxxlignore"), `${defaultPxxlIgnore.join("\n")}\n`);
}

export async function copyBoilerplate(name: string, destination: string, repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..")) {
  const src = join(repoRoot, "boilerplates", name);
  if (!(await exists(src))) throw new Error(`Unknown boilerplate: ${name}`);
  await copyDirectory(src, destination);
}

export async function readBoilerplateManifest(name: string, repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..")): Promise<BoilerplateManifest | undefined> {
  try {
    const data = await readFile(join(repoRoot, "boilerplates", name, "pxxl.boilerplate.json"), "utf8");
    return JSON.parse(data) as BoilerplateManifest;
  } catch {
    return undefined;
  }
}

async function copyDirectory(src: string, dest: string) {
  await mkdir(dest, { recursive: true });
  for (const entry of await readdir(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) await copyDirectory(from, to);
    else if (entry.isFile()) await copyFile(from, to);
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function saveAuthConfig(apiKey: string, baseUrl?: string) {
  const existing = await readStoredAuthConfig();
  const path = configPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ ...existing, apiKey, baseUrl: baseUrl || existing.baseUrl || "https://gateway.pxxl.app/api/v3" }, null, 2), { mode: 0o600 });
  await chmod(path, 0o600).catch(() => undefined);
}

export async function saveTeamSelection(teamId?: string) {
  const existing = await readStoredAuthConfig();
  const next = { ...existing, selectedTeamId: teamId || undefined };
  if (!next.apiKey && !next.baseUrl && !next.selectedTeamId) return clearAuthConfig();
  const path = configPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(next, null, 2), { mode: 0o600 });
  await chmod(path, 0o600).catch(() => undefined);
}

export async function readAuthConfig(): Promise<{ apiKey?: string; baseUrl?: string; selectedTeamId?: string }> {
  const stored = await readStoredAuthConfig();
  return {
    ...stored,
    apiKey: process.env.PXXL_API_KEY || stored.apiKey,
    baseUrl: process.env.PXXL_API_URL || stored.baseUrl,
    selectedTeamId: process.env.PXXL_TEAM_ID || stored.selectedTeamId,
  };
}

async function readStoredAuthConfig(): Promise<{ apiKey?: string; baseUrl?: string; selectedTeamId?: string }> {
  try {
    return JSON.parse(await readFile(configPath(), "utf8"));
  } catch {
    return {};
  }
}

export async function clearAuthConfig() {
  await rm(configPath(), { force: true });
}

export function configPath(): string {
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "pxxl", "config.json");
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function requiredConfig(value: string | undefined, key: string): string {
  if (!value || !String(value).trim()) throw new Error(`Missing ${key}. Add it to pxxl.toml or pass a CLI flag.`);
  return String(value).trim();
}

function teamQuery(teamId?: string): string {
  return teamId && teamId.trim() ? `?teamId=${encodeURIComponent(teamId.trim())}` : "";
}
