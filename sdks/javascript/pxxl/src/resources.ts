import { PXXL_MCP_ENDPOINT, PXXL_MCP_PROTOCOL_VERSION } from "./index.js";
import type {
  AnalyticsTimeframe,
  CreateInvoiceInput,
  ConnectDomainInput,
  CreateCronJobInput,
  CreateDatabaseInput,
  CreateStorageAccessKeyInput,
  CreateStorageBucketInput,
  CustomerInput,
  DomainCurrency,
  DomainDNSRecordInput,
  EnvVarInput,
  PxxlClient,
  PxxlRequestOptions,
  PurchaseDomainInput,
  UpdateCronJobInput,
  UpdateCustomerInput,
  UpdateDatabaseInput,
  UpdateStorageBucketInput,
} from "./index.js";

export class PxxlIdentity {
  constructor(private readonly client: PxxlClient) {}

  whoami() { return this.client.whoami(); }
  stats(teamId?: string) { return this.client.stats(teamId); }
  usage(teamId?: string) { return this.client.platformUsage(teamId); }
}

export class PxxlRawAPI {
  constructor(private readonly client: PxxlClient) {}

  request<T = unknown>(path: string, options: PxxlRequestOptions = {}) {
    return this.client.request<T>(path, options);
  }

  raw(path: string, options: PxxlRequestOptions = {}) {
    return this.client.rawRequest(path, options);
  }
}

export interface PxxlMCPOptions {
  apiKey?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  protocolVersion?: string;
}

export class PxxlMCP {
  private readonly apiKey?: string;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly protocolVersion: string;
  private requestId = 0;

  constructor(options: PxxlMCPOptions = {}) {
    this.apiKey = (options.apiKey || "").trim() || undefined;
    this.endpoint = (options.endpoint || PXXL_MCP_ENDPOINT).replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl || fetch;
    this.protocolVersion = options.protocolVersion || PXXL_MCP_PROTOCOL_VERSION;
  }

  initialize() {
    return this.rpc("initialize", {
      protocolVersion: this.protocolVersion,
      capabilities: {},
      clientInfo: { name: "@pxxlapp/pxxl", version: "0.1.12" },
    });
  }

  ping() { return this.rpc("ping"); }

  async listTools(): Promise<Array<Record<string, unknown>>> {
    const result = await this.rpc<{ tools?: Array<Record<string, unknown>> }>("tools/list");
    return result.tools || [];
  }

  callTool(name: string, arguments_: Record<string, unknown> = {}) {
    return this.rpc("tools/call", { name, arguments: arguments_ });
  }

  async listResources(): Promise<Array<Record<string, unknown>>> {
    const result = await this.rpc<{ resources?: Array<Record<string, unknown>> }>("resources/list");
    return result.resources || [];
  }

  readResource(uri: string) { return this.rpc("resources/read", { uri }); }

  async rpc<T = Record<string, unknown>>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.apiKey) throw new Error("Pxxl MCP requires an API key");
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "MCP-Protocol-Version": this.protocolVersion,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `pxxl-sdk-${++this.requestId}`,
        method,
        ...(params ? { params } : {}),
      }),
    });
    const payload = await response.json().catch(() => ({})) as {
      result?: T;
      error?: { message?: string };
    };
    if (!response.ok || payload.error || payload.result === undefined) {
      throw new Error(payload.error?.message || `Pxxl MCP request failed with ${response.status}`);
    }
    return payload.result;
  }
}

export class PxxlAssets {
  constructor(private readonly client: PxxlClient) {}

  summary() { return this.client.summary(); }
  list(input = {}) { return this.client.listAssets(input); }
  upload(input: Parameters<PxxlClient["uploadAsset"]>[0]) { return this.client.uploadAsset(input); }
  download(id: string) { return this.client.downloadAsset(id); }
  delete(id: string) { return this.client.deleteAsset(id); }
  usage(limit?: number) { return this.client.usage(limit); }
  space() { return this.client.getCDNSpace(); }
  createSpace(input?: { name?: string }) { return this.client.createCDNSpace(input); }
  proxyLogs(input?: { limit?: number; projectId?: string }) { return this.client.cdnProxyLogs(input); }
  edgeFunctions(input?: { projectId?: string; status?: string; limit?: number }) { return this.client.listEdgeFunctions(input); }
  createEdgeFunction(input: Parameters<PxxlClient["createEdgeFunction"]>[0]) { return this.client.createEdgeFunction(input); }
}

export class PxxlStorage {
  constructor(private readonly client: PxxlClient) {}

  listBuckets() { return this.client.listStorageBuckets(); }
  getBucket(id: string) { return this.client.getStorageBucket(id); }
  createBucket(input: CreateStorageBucketInput) { return this.client.createStorageBucket(input); }
  updateBucket(id: string, input: UpdateStorageBucketInput) { return this.client.updateStorageBucket(id, input); }
  deleteBucket(id: string) { return this.client.deleteStorageBucket(id); }
  listObjects(bucketId: string, input?: Parameters<PxxlClient["listStorageObjects"]>[1]) { return this.client.listStorageObjects(bucketId, input); }
  uploadObject(bucketId: string, input: Parameters<PxxlClient["uploadStorageObject"]>[1]) { return this.client.uploadStorageObject(bucketId, input); }
  downloadObject(id: string) { return this.client.downloadStorageObject(id); }
  deleteObject(id: string) { return this.client.deleteStorageObject(id); }
  analytics(id: string, timeframe?: string) { return this.client.storageAnalytics(id, timeframe); }
  billing(input?: { bucketId?: string; limit?: number }) { return this.client.storageBilling(input); }
  listAccessKeys(bucketId: string) { return this.client.listStorageAccessKeys(bucketId); }
  createAccessKey(bucketId: string, input?: CreateStorageAccessKeyInput) { return this.client.createStorageAccessKey(bucketId, input); }
  deleteAccessKey(bucketId: string, keyId: string) { return this.client.deleteStorageAccessKey(bucketId, keyId); }
}

export class PxxlAnalytics {
  constructor(private readonly client: PxxlClient) {}

  projectTraffic(projectId: string, input?: { timeframe?: AnalyticsTimeframe; domain?: string }) { return this.client.projectTraffic(projectId, input); }
  domainTraffic(domainId: string, input?: { timeframe?: AnalyticsTimeframe; teamId?: string }) { return this.client.domainTraffic(domainId, input); }
  userDomainTraffic(domain: string, timeframe?: AnalyticsTimeframe) { return this.client.userDomainTraffic(domain, timeframe); }
}

export class PxxlCustomers {
  constructor(private readonly client: PxxlClient) {}

  create(input: CustomerInput) { return this.client.createCustomer(input); }
  list() { return this.client.listCustomers(); }
  get(id: number | string) { return this.client.getCustomer(id); }
  update(id: number | string, input: UpdateCustomerInput) { return this.client.updateCustomer(id, input); }
  delete(id: number | string) { return this.client.deleteCustomer(id); }
}

export class PxxlDomains {
  constructor(private readonly client: PxxlClient) {}

  listTLDs() { return this.client.listTLDs(); }
  getTLD(tld: string) { return this.client.getTLD(tld); }
  popularTLDs() { return this.client.popularTLDs(); }
  searchTLDs(query: string) { return this.client.searchTLDs(query); }
  types() { return this.client.listTLDTypes(); }
  tldsByType(type: string) { return this.client.listTLDsByType(type); }
  availability(domain: string) { return this.client.checkDomainAvailability(domain); }
  search(input: { query: string; type?: string }) { return this.client.searchDomains(input); }
  searchDomains(input: { query: string; type?: string }) { return this.client.searchDomains(input); }
  dnsLookup(domain: string, type?: string) { return this.client.domainDNSLookup(domain, type); }
  bulkDNSLookup(domains: string[]) { return this.client.bulkDomainDNSLookup(domains); }
  verifyRegistration(domain: string) { return this.client.verifyDomainRegistration(domain); }
  addons(input?: { type?: string }) { return this.client.listDomainAddons(input); }
  addon(id: string) { return this.client.getDomainAddon(id); }
  purchase(input: PurchaseDomainInput) { return this.client.purchaseDomain(input); }
  createAddonInvoice(domainId: string, addonIds: string[], currency?: DomainCurrency) { return this.client.createDomainAddonInvoice(domainId, addonIds, currency); }
  createOrder(input: { domains: string[]; customerId?: number | string; contactId?: number | string }) { return this.client.createDomainOrder(input); }
  listOrders() { return this.client.listDomainOrders(); }
  getOrder(id: number | string) { return this.client.getDomainOrder(id); }
  updateOrderDuration(domainId: number | string, duration: number) { return this.client.updateDomainOrderDuration(domainId, duration); }
  addOrderAddons(domainId: number | string, addonIds: string[]) { return this.client.addDomainOrderAddons(domainId, addonIds); }
  listOwned(teamId?: string) { return this.client.listDomains(teamId); }
  check(domain: string, teamId?: string) { return this.client.checkDomain(domain, teamId); }
  stats(domain: string, input?: { timeframe?: string; teamId?: string }) { return this.client.domainStats(domain, input); }
  get(id: string, teamId?: string) { return this.client.getDomain(id, teamId); }
  add(input: ConnectDomainInput) { return this.client.connectDomain(input); }
  connect(input: ConnectDomainInput) { return this.client.connectDomain(input); }
  connectMany(input: ConnectDomainInput[]) { return this.client.connectDomains(input); }
  remove(domain: string, input?: { projectId?: string; teamId?: string }) { return this.client.disconnectDomain(domain, input); }
  update(id: string, input: Parameters<PxxlClient["updateDomain"]>[1]) { return this.client.updateDomain(id, input); }
  verify(input: Parameters<PxxlClient["verifyDomainRecord"]>[0]) { return this.client.verifyDomainRecord(input); }
  dnsRecords(id: string, teamId?: string) { return this.client.listDomainDNSRecords(id, teamId); }
  upsertDNSRecord(id: string, input: DomainDNSRecordInput & { teamId?: string }) { return this.client.createDomainDNSRecord(id, input); }
  replaceDNSRecords(id: string, input: DomainDNSRecordInput & { teamId?: string }) { return this.client.updateDomainDNSRecords(id, input); }
  deleteDNSRecord(id: string, input: Parameters<PxxlClient["deleteDomainDNSRecord"]>[1]) { return this.client.deleteDomainDNSRecord(id, input); }
  changeLogs(id: string, teamId?: string) { return this.client.listDomainDNSChangeLogs(id, teamId); }
  rollbackDNSChange(id: string, logId: string, teamId?: string) { return this.client.rollbackDomainDNSChange(id, logId, teamId); }
  updateNameservers(id: string, nameservers: string[], teamId?: string) { return this.client.updateDomainNameservers(id, nameservers, teamId); }
  resetNameservers(id: string, teamId?: string) { return this.client.resetDomainNameservers(id, teamId); }
  verifyNameservers(id: string, teamId?: string) { return this.client.verifyDomainNameservers(id, teamId); }
  zoneStatus(id: string, teamId?: string) { return this.client.getDomainZoneStatus(id, teamId); }
  activate(id: string, teamId?: string) { return this.client.activateDomain(id, teamId); }
  resync(domain: string, input?: { teamId?: string }) { return this.client.resyncDomainProxy(domain, input); }
  downloadCertificate(id: string, teamId?: string) { return this.client.downloadDomainCertificate(id, teamId); }
}

export class PxxlInvoices {
  constructor(private readonly client: PxxlClient) {}

  list(teamId?: string) { return this.client.listDomainInvoices(teamId); }
  get(id: string, teamId?: string) { return this.client.getDomainInvoice(id, teamId); }
  paymentUrl(id: string, currency?: DomainCurrency, teamId?: string) { return this.client.getPaymentUrl(id, currency, teamId); }
  getPaymentUrl(id: string, currency?: DomainCurrency, teamId?: string) { return this.paymentUrl(id, currency, teamId); }
  pay(id: string, teamId?: string) { return this.client.payDomainInvoice(id, teamId); }
  cancel(id: string, teamId?: string) { return this.client.cancelDomainInvoice(id, teamId); }
  bachsPay(id: string, input?: { currency?: string; baseCurrency?: string; paymentMethod?: string; teamId?: string }) { return this.client.bachsPayDomainInvoice(id, input); }
  polarPay(id: string, teamId?: string) { return this.client.polarPayDomainInvoice(id, teamId); }
  purchasedDomains() { return this.client.listPurchasedDomains(); }
}

export class PxxlBilling {
  constructor(private readonly client: PxxlClient) {}

  list(input?: { status?: string; teamId?: string }) { return this.client.listInvoices(input); }
  get(id: string, teamId?: string) { return this.client.getInvoice(id, teamId); }
  create(input: CreateInvoiceInput) { return this.client.createInvoice(input); }
  paymentLink(id: string) { return this.client.createInvoicePaymentLink(id); }
}

export class PxxlCronJobs {
  constructor(private readonly client: PxxlClient) {}

  list(input?: { teamId?: string }) { return this.client.listCronJobs(input); }
  get(id: string, teamId?: string) { return this.client.getCronJob(id, teamId); }
  create(input: CreateCronJobInput) { return this.client.createCronJob(input); }
  update(id: string, input: UpdateCronJobInput) { return this.client.updateCronJob(id, input); }
  delete(id: string, teamId?: string) { return this.client.deleteCronJob(id, teamId); }
  start(id: string, teamId?: string) { return this.client.startCronJob(id, teamId); }
  stop(id: string, teamId?: string) { return this.client.stopCronJob(id, teamId); }
  trigger(id: string, teamId?: string) { return this.client.triggerCronJob(id, teamId); }
  runs(id: string, input?: { page?: number; limit?: number; teamId?: string }) { return this.client.listCronJobRuns(id, input); }
  validateSchedule(schedule: string) { return this.client.validateCronSchedule(schedule); }
  validateURL(url: string) { return this.client.validateCronURL(url); }
}

export class PxxlProjects {
  constructor(private readonly client: PxxlClient) {}

  list(input?: { teamId?: string; page?: number; limit?: number }) { return this.client.listProjects(input); }
  get(id: string) { return this.client.getProject(id); }
  deployments(input: { projectId?: string; page?: number; limit?: number; teamId?: string } = {}) { return this.client.listDeployments(input); }
  logs(id: string, input?: { lines?: number; live?: boolean; since?: string }) { return this.client.projectLogs(id, input); }
  liveLogs(id: string, input?: { lines?: number; since?: string }) { return this.client.projectLogs(id, { ...input, live: true }); }
}

export class PxxlEnvironmentVariables {
  constructor(private readonly client: PxxlClient) {}

  list(projectId: string, options?: { global?: boolean }) { return this.client.listProjectEnv(projectId, options); }
  diff(projectId: string, vars: EnvVarInput[], options?: { global?: boolean }) { return this.client.diffProjectEnv(projectId, vars, options); }
  push(projectId: string, vars: EnvVarInput[], options?: { global?: boolean; replace?: boolean }) { return this.client.pushProjectEnv(projectId, vars, options); }
}

export class PxxlDeployments {
  constructor(private readonly client: PxxlClient) {}

  list(input?: { projectId?: string; page?: number; limit?: number; teamId?: string }) { return this.client.listDeployments(input); }
  get(id: string) { return this.client.getDeployment(id); }
  logs(id: string, input?: { build?: boolean; since?: string }) { return this.client.deploymentLogs(id, input); }
  buildLogs(id: string, since?: string) { return this.client.deploymentLogs(id, { build: true, since }); }
  redeploy(id: string, input?: { commitSha?: string; commitMessage?: string }) { return this.client.redeployProject(id, input); }
  deploy(input: Parameters<PxxlClient["deploy"]>[0]) { return this.client.deploy(input); }
}

export class PxxlTeams {
  constructor(private readonly client: PxxlClient) {}

  list() { return this.client.listTeams(); }
  get(id: string) { return this.client.getTeam(id); }
  databases(id: string) { return this.client.listTeamDatabases(id); }
}

export class PxxlDatabases {
  constructor(private readonly client: PxxlClient) {}

  list(teamId?: string) { return this.client.listDatabases(teamId); }
  get(id: string, teamId?: string) { return this.client.getDatabase(id, teamId); }
  create(input: CreateDatabaseInput) { return this.client.createDatabase(input); }
  update(id: string, input: UpdateDatabaseInput) { return this.client.updateDatabase(id, input); }
  delete(id: string, teamId?: string) { return this.client.deleteDatabase(id, teamId); }
  start(id: string, teamId?: string) { return this.client.startDatabase(id, teamId); }
  stop(id: string, teamId?: string) { return this.client.stopDatabase(id, teamId); }
  restart(id: string, teamId?: string) { return this.client.restartDatabase(id, teamId); }
  stats(id: string, teamId?: string) { return this.client.databaseStats(id, teamId); }
  metrics(id: string, teamId?: string) { return this.client.databaseMetrics(id, teamId); }
  usage(id: string, teamId?: string) { return this.client.databaseUsage(id, teamId); }
  tables(id: string, teamId?: string) { return this.client.databaseTables(id, teamId); }
  credential(id: string, field: string, teamId?: string) { return this.client.revealDatabaseCredential(id, field, teamId); }
}
