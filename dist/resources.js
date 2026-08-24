import { PXXL_MCP_ENDPOINT, PXXL_MCP_PROTOCOL_VERSION } from "./index.js";
export class PxxlIdentity {
    client;
    constructor(client) {
        this.client = client;
    }
    whoami() { return this.client.whoami(); }
    stats(teamId) { return this.client.stats(teamId); }
    usage(teamId) { return this.client.platformUsage(teamId); }
}
export class PxxlRawAPI {
    client;
    constructor(client) {
        this.client = client;
    }
    request(path, options = {}) {
        return this.client.request(path, options);
    }
    raw(path, options = {}) {
        return this.client.rawRequest(path, options);
    }
}
export class PxxlMCP {
    apiKey;
    endpoint;
    fetchImpl;
    protocolVersion;
    requestId = 0;
    constructor(options = {}) {
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
    async listTools() {
        const result = await this.rpc("tools/list");
        return result.tools || [];
    }
    callTool(name, arguments_ = {}) {
        return this.rpc("tools/call", { name, arguments: arguments_ });
    }
    async listResources() {
        const result = await this.rpc("resources/list");
        return result.resources || [];
    }
    readResource(uri) { return this.rpc("resources/read", { uri }); }
    async rpc(method, params) {
        if (!this.apiKey)
            throw new Error("Pxxl MCP requires an API key");
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
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.error || payload.result === undefined) {
            throw new Error(payload.error?.message || `Pxxl MCP request failed with ${response.status}`);
        }
        return payload.result;
    }
}
export class PxxlAssets {
    client;
    constructor(client) {
        this.client = client;
    }
    summary() { return this.client.summary(); }
    list(input = {}) { return this.client.listAssets(input); }
    upload(input) { return this.client.uploadAsset(input); }
    download(id) { return this.client.downloadAsset(id); }
    delete(id) { return this.client.deleteAsset(id); }
    usage(limit) { return this.client.usage(limit); }
    space() { return this.client.getCDNSpace(); }
    createSpace(input) { return this.client.createCDNSpace(input); }
    proxyLogs(input) { return this.client.cdnProxyLogs(input); }
    edgeFunctions(input) { return this.client.listEdgeFunctions(input); }
    createEdgeFunction(input) { return this.client.createEdgeFunction(input); }
}
export class PxxlStorage {
    client;
    constructor(client) {
        this.client = client;
    }
    listBuckets() { return this.client.listStorageBuckets(); }
    getBucket(id) { return this.client.getStorageBucket(id); }
    createBucket(input) { return this.client.createStorageBucket(input); }
    updateBucket(id, input) { return this.client.updateStorageBucket(id, input); }
    deleteBucket(id) { return this.client.deleteStorageBucket(id); }
    listObjects(bucketId, input) { return this.client.listStorageObjects(bucketId, input); }
    uploadObject(bucketId, input) { return this.client.uploadStorageObject(bucketId, input); }
    downloadObject(id) { return this.client.downloadStorageObject(id); }
    deleteObject(id) { return this.client.deleteStorageObject(id); }
    analytics(id, timeframe) { return this.client.storageAnalytics(id, timeframe); }
    billing(input) { return this.client.storageBilling(input); }
    listAccessKeys(bucketId) { return this.client.listStorageAccessKeys(bucketId); }
    createAccessKey(bucketId, input) { return this.client.createStorageAccessKey(bucketId, input); }
    deleteAccessKey(bucketId, keyId) { return this.client.deleteStorageAccessKey(bucketId, keyId); }
}
export class PxxlAnalytics {
    client;
    constructor(client) {
        this.client = client;
    }
    projectTraffic(projectId, input) { return this.client.projectTraffic(projectId, input); }
    domainTraffic(domainId, input) { return this.client.domainTraffic(domainId, input); }
    userDomainTraffic(domain, timeframe) { return this.client.userDomainTraffic(domain, timeframe); }
}
export class PxxlCustomers {
    client;
    constructor(client) {
        this.client = client;
    }
    create(input) { return this.client.createCustomer(input); }
    list() { return this.client.listCustomers(); }
    get(id) { return this.client.getCustomer(id); }
    update(id, input) { return this.client.updateCustomer(id, input); }
    delete(id) { return this.client.deleteCustomer(id); }
}
export class PxxlDomains {
    client;
    constructor(client) {
        this.client = client;
    }
    listTLDs() { return this.client.listTLDs(); }
    getTLD(tld) { return this.client.getTLD(tld); }
    popularTLDs() { return this.client.popularTLDs(); }
    searchTLDs(query) { return this.client.searchTLDs(query); }
    types() { return this.client.listTLDTypes(); }
    tldsByType(type) { return this.client.listTLDsByType(type); }
    availability(domain) { return this.client.checkDomainAvailability(domain); }
    search(input) { return this.client.searchDomains(input); }
    searchDomains(input) { return this.client.searchDomains(input); }
    dnsLookup(domain, type) { return this.client.domainDNSLookup(domain, type); }
    bulkDNSLookup(domains) { return this.client.bulkDomainDNSLookup(domains); }
    verifyRegistration(domain) { return this.client.verifyDomainRegistration(domain); }
    addons(input) { return this.client.listDomainAddons(input); }
    addon(id) { return this.client.getDomainAddon(id); }
    purchase(input) { return this.client.purchaseDomain(input); }
    createAddonInvoice(domainId, addonIds, currency) { return this.client.createDomainAddonInvoice(domainId, addonIds, currency); }
    createOrder(input) { return this.client.createDomainOrder(input); }
    listOrders() { return this.client.listDomainOrders(); }
    getOrder(id) { return this.client.getDomainOrder(id); }
    updateOrderDuration(domainId, duration) { return this.client.updateDomainOrderDuration(domainId, duration); }
    addOrderAddons(domainId, addonIds) { return this.client.addDomainOrderAddons(domainId, addonIds); }
    listOwned(teamId) { return this.client.listDomains(teamId); }
    check(domain, teamId) { return this.client.checkDomain(domain, teamId); }
    stats(domain, input) { return this.client.domainStats(domain, input); }
    get(id, teamId) { return this.client.getDomain(id, teamId); }
    add(input) { return this.client.connectDomain(input); }
    connect(input) { return this.client.connectDomain(input); }
    connectMany(input) { return this.client.connectDomains(input); }
    remove(domain, input) { return this.client.disconnectDomain(domain, input); }
    update(id, input) { return this.client.updateDomain(id, input); }
    verify(input) { return this.client.verifyDomainRecord(input); }
    dnsRecords(id, teamId) { return this.client.listDomainDNSRecords(id, teamId); }
    upsertDNSRecord(id, input) { return this.client.createDomainDNSRecord(id, input); }
    replaceDNSRecords(id, input) { return this.client.updateDomainDNSRecords(id, input); }
    deleteDNSRecord(id, input) { return this.client.deleteDomainDNSRecord(id, input); }
    changeLogs(id, teamId) { return this.client.listDomainDNSChangeLogs(id, teamId); }
    rollbackDNSChange(id, logId, teamId) { return this.client.rollbackDomainDNSChange(id, logId, teamId); }
    updateNameservers(id, nameservers, teamId) { return this.client.updateDomainNameservers(id, nameservers, teamId); }
    resetNameservers(id, teamId) { return this.client.resetDomainNameservers(id, teamId); }
    verifyNameservers(id, teamId) { return this.client.verifyDomainNameservers(id, teamId); }
    zoneStatus(id, teamId) { return this.client.getDomainZoneStatus(id, teamId); }
    activate(id, teamId) { return this.client.activateDomain(id, teamId); }
    resync(domain, input) { return this.client.resyncDomainProxy(domain, input); }
    downloadCertificate(id, teamId) { return this.client.downloadDomainCertificate(id, teamId); }
}
export class PxxlInvoices {
    client;
    constructor(client) {
        this.client = client;
    }
    list(teamId) { return this.client.listDomainInvoices(teamId); }
    get(id, teamId) { return this.client.getDomainInvoice(id, teamId); }
    paymentUrl(id, currency, teamId) { return this.client.getPaymentUrl(id, currency, teamId); }
    getPaymentUrl(id, currency, teamId) { return this.paymentUrl(id, currency, teamId); }
    pay(id, teamId) { return this.client.payDomainInvoice(id, teamId); }
    cancel(id, teamId) { return this.client.cancelDomainInvoice(id, teamId); }
    bachsPay(id, input) { return this.client.bachsPayDomainInvoice(id, input); }
    polarPay(id, teamId) { return this.client.polarPayDomainInvoice(id, teamId); }
    purchasedDomains() { return this.client.listPurchasedDomains(); }
}
export class PxxlBilling {
    client;
    constructor(client) {
        this.client = client;
    }
    list(input) { return this.client.listInvoices(input); }
    get(id, teamId) { return this.client.getInvoice(id, teamId); }
    create(input) { return this.client.createInvoice(input); }
    paymentLink(id) { return this.client.createInvoicePaymentLink(id); }
}
export class PxxlCronJobs {
    client;
    constructor(client) {
        this.client = client;
    }
    list(input) { return this.client.listCronJobs(input); }
    get(id, teamId) { return this.client.getCronJob(id, teamId); }
    create(input) { return this.client.createCronJob(input); }
    update(id, input) { return this.client.updateCronJob(id, input); }
    delete(id, teamId) { return this.client.deleteCronJob(id, teamId); }
    start(id, teamId) { return this.client.startCronJob(id, teamId); }
    stop(id, teamId) { return this.client.stopCronJob(id, teamId); }
    trigger(id, teamId) { return this.client.triggerCronJob(id, teamId); }
    runs(id, input) { return this.client.listCronJobRuns(id, input); }
    validateSchedule(schedule) { return this.client.validateCronSchedule(schedule); }
    validateURL(url) { return this.client.validateCronURL(url); }
}
export class PxxlProjects {
    client;
    constructor(client) {
        this.client = client;
    }
    list(input) { return this.client.listProjects(input); }
    get(id) { return this.client.getProject(id); }
    deployments(input = {}) { return this.client.listDeployments(input); }
    logs(id, input) { return this.client.projectLogs(id, input); }
    liveLogs(id, input) { return this.client.projectLogs(id, { ...input, live: true }); }
}
export class PxxlEnvironmentVariables {
    client;
    constructor(client) {
        this.client = client;
    }
    list(projectId, options) { return this.client.listProjectEnv(projectId, options); }
    diff(projectId, vars, options) { return this.client.diffProjectEnv(projectId, vars, options); }
    push(projectId, vars, options) { return this.client.pushProjectEnv(projectId, vars, options); }
}
export class PxxlDeployments {
    client;
    constructor(client) {
        this.client = client;
    }
    list(input) { return this.client.listDeployments(input); }
    get(id) { return this.client.getDeployment(id); }
    logs(id, input) { return this.client.deploymentLogs(id, input); }
    buildLogs(id, since) { return this.client.deploymentLogs(id, { build: true, since }); }
    redeploy(id, input) { return this.client.redeployProject(id, input); }
    deploy(input) { return this.client.deploy(input); }
}
export class PxxlTeams {
    client;
    constructor(client) {
        this.client = client;
    }
    list() { return this.client.listTeams(); }
    get(id) { return this.client.getTeam(id); }
    databases(id) { return this.client.listTeamDatabases(id); }
}
export class PxxlDatabases {
    client;
    constructor(client) {
        this.client = client;
    }
    list(teamId) { return this.client.listDatabases(teamId); }
    get(id, teamId) { return this.client.getDatabase(id, teamId); }
    create(input) { return this.client.createDatabase(input); }
    update(id, input) { return this.client.updateDatabase(id, input); }
    delete(id, teamId) { return this.client.deleteDatabase(id, teamId); }
    start(id, teamId) { return this.client.startDatabase(id, teamId); }
    stop(id, teamId) { return this.client.stopDatabase(id, teamId); }
    restart(id, teamId) { return this.client.restartDatabase(id, teamId); }
    stats(id, teamId) { return this.client.databaseStats(id, teamId); }
    metrics(id, teamId) { return this.client.databaseMetrics(id, teamId); }
    usage(id, teamId) { return this.client.databaseUsage(id, teamId); }
    tables(id, teamId) { return this.client.databaseTables(id, teamId); }
    credential(id, field, teamId) { return this.client.revealDatabaseCredential(id, field, teamId); }
}
