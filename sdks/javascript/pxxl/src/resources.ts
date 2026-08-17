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
  PxxlClient,
  PurchaseDomainInput,
  UpdateCronJobInput,
  UpdateCustomerInput,
  UpdateDatabaseInput,
  UpdateStorageBucketInput,
} from "./index.js";

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
  tables(id: string, teamId?: string) { return this.client.databaseTables(id, teamId); }
}
