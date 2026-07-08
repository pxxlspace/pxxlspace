import { access, readFile, readdir, writeFile, mkdir, copyFile, chmod, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, basename } from "node:path";
import { zipSync } from "fflate";
import ignore from "ignore";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";

export type CDNVisibility = "private" | "public";
export type CDNAssetKind = "file" | "artifact";
export const PXXL_API_BASE_URL = "https://gateway.pxxl.app/api/v3";
export const MAX_DEPLOY_FILES = 12000;
export const MAX_DEPLOY_SOURCE_BYTES = 220 * 1024 * 1024;

export interface PxxlClientOptions {
  apiKey?: string;
  /** @deprecated The public SDK always uses the official Pxxl API base URL. */
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

export interface DomainSummary {
  id?: string;
  name?: string;
  domain?: string;
  status?: string;
  type?: string;
  projectId?: string | null;
  serviceAlias?: string;
  servicePort?: number;
  serviceScope?: string;
  createdAt?: string;
}

export interface ConnectDomainInput {
  domain: string;
  projectId: string;
  alias?: boolean;
  serviceAlias?: string;
  serviceId?: string;
  microserviceId?: string;
  servicePort?: number;
  teamId?: string;
}

export interface ConnectDomainsResult {
  accepted: unknown[];
  rejected: Array<{ domain: string; status: number; message: string; details?: unknown }>;
  attempted: number;
}

export interface VerifyDomainRecordInput {
  domain: string;
  projectId: string;
  teamId?: string;
}

export interface DomainDNSRecordInput {
  type?: string;
  name?: string;
  value?: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
  id?: string;
  recordId?: string;
  zoneId?: string;
  records?: DomainDNSRecordInput[];
}

export interface ManagedSubdomainInput {
  label?: string;
  subdomain?: string;
  projectId?: string;
  teamId?: string;
}

export interface DomainSettingsInput {
  isPxxlManaged?: boolean;
  isPxxlNS?: boolean;
  forceHttps?: boolean;
  allowWebsocket?: boolean;
  isActive?: boolean;
  projectId?: string | null;
  proxyRules?: Record<string, unknown>;
  teamId?: string;
}

export interface CronJob {
  id: string;
  userId?: string;
  projectId?: string | null;
  teamId?: string | null;
  name: string;
  schedule: string;
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | string;
  headers?: Record<string, string>;
  timeoutSeconds: number;
  status: "active" | "paused" | "disabled" | string;
  consecutiveFailures?: number;
  disabledReason?: string | null;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CronJobRun {
  id: string;
  cronJobId: string;
  status: "running" | "success" | "failed" | string;
  statusCode?: number | null;
  output?: string | null;
  error?: string | null;
  timedOut?: boolean;
  startedAt: string;
  finishedAt?: string | null;
}

export interface CreateCronJobInput {
  name: string;
  schedule: string;
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | string;
  headers?: Record<string, string>;
  timeoutSeconds?: number;
  projectId?: string;
  teamId?: string;
}

export interface UpdateCronJobInput {
  name?: string;
  schedule?: string;
  url?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | string;
  headers?: Record<string, string>;
  timeoutSeconds?: number;
  status?: "active" | "paused" | "disabled" | string;
  projectId?: string;
  teamId?: string;
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

export interface ProjectSummary {
  id: string;
  name: string;
  status?: string;
  projectType?: string;
  githubUrl?: string | null;
  githubBranch?: string | null;
  baseDirectory?: string | null;
  installCommand?: string | null;
  buildCommand?: string | null;
  startCommand?: string | null;
  framework?: string;
  language?: string;
}

export interface EnvVarInput {
  key: string;
  value: string;
  isSecret?: boolean;
}

export interface EnvDiffRow {
  key: string;
  status: "same" | "changed" | "missing_remote" | "missing_local" | string;
  local: boolean;
  remote: boolean;
  same: boolean;
  localHash?: string;
  remoteHash?: string;
}

export interface EnvDiffResult {
  success?: boolean;
  projectId: string;
  scope: string;
  counts: Record<string, number>;
  diff: EnvDiffRow[];
}

export interface RedeployInput {
  commitSha?: string;
  commitMessage?: string;
}

export interface DomainInvoice {
  id: string;
  userId?: string;
  teamId?: string | null;
  type?: string;
  status: string;
  domains?: unknown;
  total?: number;
  taxAmount?: number;
  totalNgn?: number;
  taxAmountNgn?: number;
  totalUsd?: number;
  taxAmountUsd?: number;
  currency?: string;
  paymentUrl?: string | null;
  expiresAt?: string;
  paidAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  grandTotal?: number;
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
  projectId?: string;
  deploymentId?: string;
  projectUrl?: string;
  deploymentUrl?: string;
  lastDeployedAt?: string;
  commitMessage?: string;
}

export interface BoilerplateManifest extends DeployConfig {
  id: string;
  name?: string;
  displayName?: string;
  family?: string;
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

function readStringPath(value: unknown, path: string[]): string | undefined {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" && current.trim() ? current.trim() : undefined;
}

function domainNameFromResponse(value: unknown): string {
  const candidates = [
    ["name"],
    ["domainName"],
    ["domain"],
    ["domain", "name"],
    ["domain", "domain"],
    ["data", "name"],
    ["data", "domainName"],
    ["data", "domain"],
    ["data", "domain", "name"],
    ["data", "domain", "domain"],
  ];
  for (const path of candidates) {
    const candidate = readStringPath(value, path);
    if (candidate) return candidate.toLowerCase().replace(/\.$/, "");
  }
  return "";
}

function isCvDomainName(domain: string): boolean {
  return domain.toLowerCase().replace(/\.$/, "").endsWith(".cv");
}

function isCvZoneOnlyError(error: unknown): boolean {
  return error instanceof PxxlAPIError && /zone status .*only available for \.cv domains/i.test(error.message);
}

export class PxxlClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly teamId?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PxxlClientOptions = {}) {
    this.apiKey = (options.apiKey || "").trim() || undefined;
    this.baseUrl = PXXL_API_BASE_URL;
    this.teamId = (options.teamId || "").trim() || undefined;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async whoami(): Promise<unknown> {
    return this.request("/cli/whoami");
  }

  async stats(teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/stats${teamQuery(teamId)}`);
  }

  async platformUsage(teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/usage${teamQuery(teamId)}`);
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

  async listDomains(teamId = this.teamId): Promise<{ domains: Array<DomainSummary | string>; total?: number; success?: boolean }> {
    return this.request(`/cli/domains${teamQuery(teamId)}`);
  }

  async domainStats(domain: string, input: { timeframe?: string; teamId?: string } = {}): Promise<unknown> {
    const params = new URLSearchParams();
    if (input.timeframe) params.set("timeframe", input.timeframe);
    const teamId = input.teamId || this.teamId;
    if (teamId) params.set("teamId", teamId);
    const suffix = params.size ? `?${params.toString()}` : "";
    return this.request(`/cli/domains/${encodeURIComponent(domain)}/stats${suffix}`);
  }

  async checkDomain(domain: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/domains/${encodeURIComponent(domain)}/check${teamQuery(teamId)}`);
  }

  async connectDomain(input: ConnectDomainInput): Promise<unknown> {
    const teamId = input.teamId || this.teamId;
    const serviceAlias = input.serviceAlias || input.microserviceId || input.serviceId;
    return this.request(`/cli/domains${teamQuery(teamId)}`, {
      method: "POST",
      body: JSON.stringify({
        domain: input.domain,
        projectId: input.projectId,
        alias: Boolean(input.alias),
        ...(serviceAlias ? { serviceAlias } : {}),
        ...(input.servicePort ? { servicePort: input.servicePort } : {}),
      }),
    });
  }

  async connectDomains(input: ConnectDomainInput[]): Promise<ConnectDomainsResult> {
    const result: ConnectDomainsResult = { accepted: [], rejected: [], attempted: input.length };
    for (const item of input) {
      try {
        result.accepted.push(await this.connectDomain(item));
      } catch (error) {
        if (error instanceof PxxlAPIError) {
          result.rejected.push({ domain: item.domain, status: error.status, message: error.message, details: error.details });
          continue;
        }
        throw error;
      }
    }
    return result;
  }

  async verifyDomainRecord(input: VerifyDomainRecordInput): Promise<unknown> {
    const teamId = input.teamId || this.teamId;
    return this.request(`/cli/domains/checkrecord${teamQuery(teamId)}`, {
      method: "POST",
      body: JSON.stringify({ domain: input.domain, projectId: input.projectId, teamId }),
    });
  }

  async verifyDomainDNSRecord(input: VerifyDomainRecordInput): Promise<unknown> {
    return this.verifyDomainRecord(input);
  }

  async getDomain(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/domains/${encodeURIComponent(id)}${teamQuery(teamId)}`);
  }

  async updateDomain(id: string, input: DomainSettingsInput): Promise<unknown> {
    const teamId = input.teamId || this.teamId;
    const { teamId: _teamId, ...body } = input;
    return this.request(`/cli/domains/${encodeURIComponent(id)}${teamQuery(teamId)}`, { method: "PATCH", body: JSON.stringify(body) });
  }

  async disconnectDomain(domain: string, input: { projectId?: string; teamId?: string } = {}): Promise<unknown> {
    const params = new URLSearchParams();
    const teamId = input.teamId || this.teamId;
    if (input.projectId) params.set("projectId", input.projectId);
    if (teamId) params.set("teamId", teamId);
    const suffix = params.size ? `?${params.toString()}` : "";
    return this.request(`/cli/domains/${encodeURIComponent(domain)}${suffix}`, { method: "DELETE" });
  }

  async resyncDomainProxy(domain: string, input: { teamId?: string } = {}): Promise<unknown> {
    return this.request(`/cli/domains/${encodeURIComponent(domain)}/resync${teamQuery(input.teamId || this.teamId)}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  async domainInfraAction(domain: string, type: "resync" | "fetch" | "certificate" | "ssl", input: { teamId?: string } = {}): Promise<unknown> {
    return this.request(`/cli/domains/${encodeURIComponent(domain)}/infra/${encodeURIComponent(type)}${teamQuery(input.teamId || this.teamId)}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  async downloadDomainCertificate(id: string, teamId = this.teamId): Promise<Blob> {
    const response = await this.rawRequest(`/cli/domains/${encodeURIComponent(id)}/certificate/download${teamQuery(teamId)}`);
    return response.blob();
  }

  async listDomainDNSRecords(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/domains/${encodeURIComponent(id)}/dns-records${teamQuery(teamId)}`);
  }

  async createDomainDNSRecord(id: string, input: DomainDNSRecordInput & { teamId?: string }): Promise<unknown> {
    const teamId = input.teamId || this.teamId;
    const { teamId: _teamId, ...body } = input;
    return this.request(`/cli/domains/${encodeURIComponent(id)}/dns-records${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify(body) });
  }

  async updateDomainDNSRecords(id: string, input: DomainDNSRecordInput & { teamId?: string }): Promise<unknown> {
    const teamId = input.teamId || this.teamId;
    const { teamId: _teamId, ...body } = input;
    return this.request(`/cli/domains/${encodeURIComponent(id)}/dns-records${teamQuery(teamId)}`, { method: "PUT", body: JSON.stringify(body) });
  }

  async deleteDomainDNSRecord(id: string, input: Pick<DomainDNSRecordInput, "id" | "recordId" | "zoneId"> & { teamId?: string }): Promise<unknown> {
    const teamId = input.teamId || this.teamId;
    const { teamId: _teamId, ...body } = input;
    return this.request(`/cli/domains/${encodeURIComponent(id)}/dns-records${teamQuery(teamId)}`, { method: "DELETE", body: JSON.stringify(body) });
  }

  async listDomainDNSChangeLogs(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/domains/${encodeURIComponent(id)}/dns-change-logs${teamQuery(teamId)}`);
  }

  async rollbackDomainDNSChange(id: string, logId: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/domains/${encodeURIComponent(id)}/dns-change-logs/${encodeURIComponent(logId)}/rollback${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
  }

  async createManagedSubdomain(id: string, input: ManagedSubdomainInput): Promise<unknown> {
    const teamId = input.teamId || this.teamId;
    return this.request(`/cli/domains/${encodeURIComponent(id)}/subdomains${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({ ...input, teamId }) });
  }

  async updateDomainNameservers(id: string, nameservers: string[], teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/domains/${encodeURIComponent(id)}/nameservers${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({ nameservers }) });
  }

  async resetDomainNameservers(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/domains/${encodeURIComponent(id)}/nameservers/reset${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
  }

  async verifyDomainNameservers(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/domains/${encodeURIComponent(id)}/nameservers/verify${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
  }

  async getDomainZoneStatus(id: string, teamId = this.teamId): Promise<unknown> {
    return this.getDomainConnectionStatus(id, teamId);
  }

  async getDomainConnectionStatus(id: string, teamId = this.teamId): Promise<unknown> {
    const domain = await this.getDomain(id, teamId);
    const name = domainNameFromResponse(domain);
    if (isCvDomainName(name)) {
      try {
        return await this.getDomainZoneStatusRaw(id, teamId);
      } catch (error) {
        if (!isCvZoneOnlyError(error)) throw error;
      }
    }
    return this.activateDomain(id, teamId);
  }

  private async getDomainZoneStatusRaw(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/domains/${encodeURIComponent(id)}/zone-status${teamQuery(teamId)}`);
  }

  async switchDomainToPxxlDNS(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/domains/${encodeURIComponent(id)}/switch-to-pxxl-dns${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
  }

  async activateDomain(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/domains/${encodeURIComponent(id)}/activate${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
  }

  async listCronJobs(input: { teamId?: string } = {}): Promise<{ cronJobs: CronJob[] }> {
    return this.request(`/cli/cronjobs${teamQuery(input.teamId || this.teamId)}`);
  }

  async createCronJob(input: CreateCronJobInput): Promise<CronJob> {
    const teamId = input.teamId || this.teamId;
    const { teamId: _teamId, ...body } = input;
    return this.request(`/cli/cronjobs${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify(body) });
  }

  async getCronJob(id: string, teamId = this.teamId): Promise<CronJob> {
    return this.request(`/cli/cronjobs/${encodeURIComponent(id)}${teamQuery(teamId)}`);
  }

  async updateCronJob(id: string, input: UpdateCronJobInput): Promise<CronJob> {
    const teamId = input.teamId || this.teamId;
    const { teamId: _teamId, ...body } = input;
    return this.request(`/cli/cronjobs/${encodeURIComponent(id)}${teamQuery(teamId)}`, { method: "PUT", body: JSON.stringify(body) });
  }

  async deleteCronJob(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/cronjobs/${encodeURIComponent(id)}${teamQuery(teamId)}`, { method: "DELETE" });
  }

  async startCronJob(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/cronjobs/${encodeURIComponent(id)}/start${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
  }

  async stopCronJob(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/cronjobs/${encodeURIComponent(id)}/stop${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
  }

  async triggerCronJob(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/cronjobs/${encodeURIComponent(id)}/trigger${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
  }

  async listCronJobRuns(id: string, input: { page?: number; limit?: number; teamId?: string } = {}): Promise<{ runs: CronJobRun[]; total?: number; page?: number; limit?: number; totalPages?: number }> {
    const params = new URLSearchParams();
    if (input.page) params.set("page", String(input.page));
    if (input.limit) params.set("limit", String(input.limit));
    const teamId = input.teamId || this.teamId;
    if (teamId) params.set("teamId", teamId);
    const suffix = params.size ? `?${params.toString()}` : "";
    return this.request(`/cli/cronjobs/${encodeURIComponent(id)}/runs${suffix}`);
  }

  async validateCronSchedule(schedule: string): Promise<unknown> {
    return this.request("/cli/cronjobs/validate-schedule", { method: "POST", body: JSON.stringify({ schedule }) });
  }

  async validateCronURL(url: string): Promise<unknown> {
    return this.request("/cli/cronjobs/validate-url", { method: "POST", body: JSON.stringify({ url }) });
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

  async getProject(id: string): Promise<{ project?: ProjectSummary; data?: ProjectSummary; success?: boolean } & Record<string, unknown>> {
    return this.request(`/cli/projects/${encodeURIComponent(id)}`);
  }

  async listProjects(input: { teamId?: string; page?: number; limit?: number } | string = {}): Promise<unknown> {
    const options = typeof input === "string" ? { teamId: input } : input;
    const params = new URLSearchParams();
    if (options.page) params.set("page", String(options.page));
    if (options.limit) params.set("limit", String(options.limit));
    const teamId = options.teamId || this.teamId;
    if (teamId) params.set("teamId", teamId);
    const suffix = params.size ? `?${params.toString()}` : "";
    return this.request(`/cli/projects${suffix}`);
  }

  async listDeployments(input: { projectId?: string; page?: number; limit?: number; teamId?: string } = {}): Promise<unknown> {
    const params = new URLSearchParams();
    if (input.page) params.set("page", String(input.page));
    if (input.limit) params.set("limit", String(input.limit));
    const teamId = input.teamId || this.teamId;
    if (teamId) params.set("teamId", teamId);
    const suffix = params.size ? `?${params.toString()}` : "";
    if (input.projectId) return this.request(`/cli/projects/${encodeURIComponent(input.projectId)}/deployments${suffix}`);
    return this.request(`/cli/deployments${suffix}`);
  }

  async getDeployment(id: string): Promise<unknown> {
    return this.request(`/cli/deployments/${encodeURIComponent(id)}`);
  }

  async projectLogs(id: string, input: { lines?: number; live?: boolean; since?: string } = {}): Promise<unknown> {
    const params = new URLSearchParams();
    if (input.lines) params.set(input.live ? "tail" : "lines", String(input.lines));
    if (input.since) params.set("since", input.since);
    const suffix = params.size ? `?${params.toString()}` : "";
    const path = input.live ? "live-logs" : "logs";
    return this.request(`/cli/projects/${encodeURIComponent(id)}/${path}${suffix}`);
  }

  async deploymentLogs(id: string, input: { build?: boolean; since?: string } = {}): Promise<unknown> {
    const params = new URLSearchParams();
    if (input.since) params.set("since", input.since);
    const suffix = params.size ? `?${params.toString()}` : "";
    const path = input.build === false ? "logs" : "build-logs";
    return this.request(`/cli/deployments/${encodeURIComponent(id)}/${path}${suffix}`);
  }

  async deployDomainOptions(): Promise<unknown> {
    return this.request("/cli/domains/deploy-options");
  }

  async redeployProject(id: string, input: RedeployInput = {}): Promise<unknown> {
    return this.request(`/cli/projects/${encodeURIComponent(id)}/redeploy`, { method: "POST", body: JSON.stringify(input) });
  }

  async pushProjectEnv(id: string, vars: EnvVarInput[], options: { global?: boolean; replace?: boolean } = {}): Promise<unknown> {
    const path = options.global ? `/cli/projects/${encodeURIComponent(id)}/global-envs/bulk` : `/cli/projects/${encodeURIComponent(id)}/envs/bulk`;
    return this.request(path, { method: "POST", body: JSON.stringify({ vars, replace: Boolean(options.replace) }) });
  }

  async diffProjectEnv(id: string, vars: EnvVarInput[], options: { global?: boolean } = {}): Promise<EnvDiffResult> {
    const path = options.global ? `/cli/projects/${encodeURIComponent(id)}/global-envs/diff` : `/cli/projects/${encodeURIComponent(id)}/envs/diff`;
    return this.request(path, { method: "POST", body: JSON.stringify({ vars }) });
  }

  async listProjectEnv(id: string, options: { global?: boolean } = {}): Promise<unknown> {
    const path = options.global ? `/cli/projects/${encodeURIComponent(id)}/global-envs` : `/cli/projects/${encodeURIComponent(id)}/envs`;
    return this.request(path);
  }

  async listDomainInvoices(teamId = this.teamId): Promise<{ invoices: DomainInvoice[]; error?: boolean }> {
    return this.request(`/cli/domainprovider/invoices${teamQuery(teamId)}`);
  }

  async getDomainInvoice(id: string, teamId = this.teamId): Promise<{ invoice: DomainInvoice; registrations?: unknown[]; grandTotal?: number; error?: boolean }> {
    return this.request(`/cli/domainprovider/invoice/${encodeURIComponent(id)}${teamQuery(teamId)}`);
  }

  async getDomainInvoicePaymentUrl(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/domainprovider/invoice/${encodeURIComponent(id)}/payment-url${teamQuery(teamId)}`);
  }

  async cancelDomainInvoice(id: string, teamId = this.teamId): Promise<unknown> {
    return this.request(`/cli/domainprovider/invoice/${encodeURIComponent(id)}/cancel${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
  }

  async deploy(input: DeployInput): Promise<unknown> {
    const cwd = resolve(input.cwd || process.cwd());
    const config = { ...(await readPxxlToml(cwd)), ...input };
    const archive = input.archivePath ? await readFile(input.archivePath) : await createProjectZip(cwd);
    const form = new FormData();
    const archiveBytes = archive instanceof Uint8Array ? archive : new Uint8Array(archive);
    const archivePart = archiveBytes.buffer.slice(archiveBytes.byteOffset, archiveBytes.byteOffset + archiveBytes.byteLength) as ArrayBuffer;
    form.append("file", new Blob([archivePart]), basename(input.archivePath || "pxxl-source.zip"));
    if (config.projectId) form.append("projectId", config.projectId);
    if (config.projectId) {
      if (config.name) form.append("name", config.name);
      if (config.domainChoice) form.append("domainChoice", config.domainChoice);
    } else {
      form.append("name", requiredConfig(config.name, "name"));
      form.append("domainChoice", requiredConfig(config.domainChoice, "domainChoice"));
    }
    form.append("environment", config.environment || "production");
    form.append("sourceShape", "clideploy");
    form.append("deploymentSource", "clideploy");
    for (const key of ["deployEnvironment", "port", "language", "framework", "packageManager", "installCommand", "buildCommand", "startCommand", "baseDirectory", "entryFile", "commitMessage"] as const) {
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
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    } catch (error) {
      const cause = error instanceof Error && error.message ? ` (${error.message})` : "";
      throw new PxxlAPIError(`Could not reach Pxxl Gateway${cause}. Check your internet connection and try again.`, 0, { cause: error instanceof Error ? error.message : String(error) });
    }
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
  ".pxxlignore",
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
  const limits = { count: 0, bytes: 0 };
  await collectFiles(root, root, matcher, files, limits);
  if (Object.keys(files).length === 0) throw new Error("No deployable files found after applying .pxxlignore");
  return zipSync(files, { level: 6, mtime: new Date(Date.UTC(1980, 0, 1)) });
}

async function collectFiles(root: string, dir: string, matcher: ReturnType<typeof ignore>, files: Record<string, Uint8Array>, limits: { count: number; bytes: number }) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    const rel = relative(root, full).replace(/\\/g, "/");
    if (!rel || matcher.ignores(rel) || matcher.ignores(`${rel}/`)) continue;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      await collectFiles(root, full, matcher, files, limits);
      continue;
    }
    if (!entry.isFile()) continue;
    if (looksSensitive(rel)) throw new Error(`Refusing to package sensitive file: ${rel}`);
    const bytes = await readFile(full);
    limits.count += 1;
    limits.bytes += bytes.byteLength;
    if (limits.count > MAX_DEPLOY_FILES) throw new Error(`Refusing to package more than ${MAX_DEPLOY_FILES} files. Add entries to .pxxlignore.`);
    if (limits.bytes > MAX_DEPLOY_SOURCE_BYTES) throw new Error(`Refusing to package more than ${Math.round(MAX_DEPLOY_SOURCE_BYTES / 1024 / 1024)} MiB of source files. Add entries to .pxxlignore.`);
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

export async function saveAuthConfig(apiKey: string, _baseUrl?: string) {
  const existing = await readStoredAuthConfig();
  const path = configPath();
  await mkdir(dirname(path), { recursive: true });
  const { baseUrl: _ignored, ...rest } = existing;
  await writeFile(path, JSON.stringify({ ...rest, apiKey }, null, 2), { mode: 0o600 });
  await chmod(path, 0o600).catch(() => undefined);
}

export async function saveTeamSelection(teamId?: string) {
  const existing = await readStoredAuthConfig();
  const next = { ...existing, selectedTeamId: teamId || undefined };
  const { baseUrl: _ignored, ...stored } = next;
  if (!stored.apiKey && !stored.selectedTeamId) return clearAuthConfig();
  const path = configPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(stored, null, 2), { mode: 0o600 });
  await chmod(path, 0o600).catch(() => undefined);
}

export async function readAuthConfig(): Promise<{ apiKey?: string; selectedTeamId?: string }> {
  const stored = await readStoredAuthConfig();
  return {
    apiKey: process.env.PXXL_API_KEY || stored.apiKey,
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
