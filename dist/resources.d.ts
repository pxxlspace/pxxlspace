import type { AnalyticsTimeframe, CreateInvoiceInput, ConnectDomainInput, CreateCronJobInput, CreateDatabaseInput, CreateStorageAccessKeyInput, CreateStorageBucketInput, CustomerInput, DomainCurrency, DomainDNSRecordInput, PxxlClient, PurchaseDomainInput, UpdateCronJobInput, UpdateCustomerInput, UpdateDatabaseInput, UpdateStorageBucketInput } from "./index.js";
export declare class PxxlAssets {
    private readonly client;
    constructor(client: PxxlClient);
    summary(): Promise<import("./index.js").CDNSummary>;
    list(input?: {}): Promise<{
        assets: import("./index.js").CDNAsset[];
        pagination: unknown;
    }>;
    upload(input: Parameters<PxxlClient["uploadAsset"]>[0]): Promise<import("./index.js").CDNAsset>;
    download(id: string): Promise<Blob>;
    delete(id: string): Promise<void>;
    usage(limit?: number): Promise<unknown[]>;
    space(): Promise<{
        space: import("./index.js").CDNSpace;
        storageName?: string;
    }>;
    createSpace(input?: {
        name?: string;
    }): Promise<{
        space: import("./index.js").CDNSpace;
        storageName?: string;
    }>;
}
export declare class PxxlStorage {
    private readonly client;
    constructor(client: PxxlClient);
    listBuckets(): Promise<{
        buckets: import("./index.js").StorageBucket[];
        total?: number;
        access?: unknown;
    }>;
    getBucket(id: string): Promise<{
        bucket: import("./index.js").StorageBucket;
        access?: unknown;
    }>;
    createBucket(input: CreateStorageBucketInput): Promise<{
        bucket: import("./index.js").StorageBucket;
        access?: unknown;
    }>;
    updateBucket(id: string, input: UpdateStorageBucketInput): Promise<{
        bucket: import("./index.js").StorageBucket;
        access?: unknown;
    }>;
    deleteBucket(id: string): Promise<void>;
    listObjects(bucketId: string, input?: Parameters<PxxlClient["listStorageObjects"]>[1]): Promise<{
        assets: import("./index.js").CDNAsset[];
        pagination: unknown;
    }>;
    uploadObject(bucketId: string, input: Parameters<PxxlClient["uploadStorageObject"]>[1]): Promise<import("./index.js").CDNAsset>;
    downloadObject(id: string): Promise<Blob>;
    deleteObject(id: string): Promise<void>;
    analytics(id: string, timeframe?: string): Promise<import("./index.js").StorageBucketAnalytics>;
    billing(input?: {
        bucketId?: string;
        limit?: number;
    }): Promise<import("./index.js").StorageBillingResponse>;
    listAccessKeys(bucketId: string): Promise<{
        keys: import("./index.js").StorageAccessKey[];
    }>;
    createAccessKey(bucketId: string, input?: CreateStorageAccessKeyInput): Promise<{
        key: import("./index.js").StorageAccessKey;
        notice?: string;
    }>;
    deleteAccessKey(bucketId: string, keyId: string): Promise<void>;
}
export declare class PxxlAnalytics {
    private readonly client;
    constructor(client: PxxlClient);
    projectTraffic(projectId: string, input?: {
        timeframe?: AnalyticsTimeframe;
        domain?: string;
    }): Promise<unknown>;
    domainTraffic(domainId: string, input?: {
        timeframe?: AnalyticsTimeframe;
        teamId?: string;
    }): Promise<unknown>;
    userDomainTraffic(domain: string, timeframe?: AnalyticsTimeframe): Promise<unknown>;
}
export declare class PxxlCustomers {
    private readonly client;
    constructor(client: PxxlClient);
    create(input: CustomerInput): Promise<import("./index.js").Customer>;
    list(): Promise<{
        customers: import("./index.js").Customer[];
        count: number;
    }>;
    get(id: number | string): Promise<import("./index.js").Customer>;
    update(id: number | string, input: UpdateCustomerInput): Promise<import("./index.js").Customer>;
    delete(id: number | string): Promise<void>;
}
export declare class PxxlDomains {
    private readonly client;
    constructor(client: PxxlClient);
    listTLDs(): Promise<{
        tlds: import("./index.js").DomainTLD[];
        count: number;
    }>;
    getTLD(tld: string): Promise<{
        tld: import("./index.js").DomainTLD;
    }>;
    popularTLDs(): Promise<{
        tlds: import("./index.js").DomainTLD[];
        count: number;
    }>;
    searchTLDs(query: string): Promise<{
        tlds: import("./index.js").DomainTLD[];
        count: number;
        query: string;
    }>;
    search(input: {
        query: string;
        type?: string;
    }): Promise<{
        query: string;
        results: import("./index.js").DomainSearchResult[];
        count: number;
        latency?: number;
        cached?: boolean;
    }>;
    searchDomains(input: {
        query: string;
        type?: string;
    }): Promise<{
        query: string;
        results: import("./index.js").DomainSearchResult[];
        count: number;
        latency?: number;
        cached?: boolean;
    }>;
    dnsLookup(domain: string, type?: string): Promise<import("./index.js").DomainDNSLookupResult>;
    bulkDNSLookup(domains: string[]): Promise<{
        results: Record<string, import("./index.js").DomainDNSLookupResult>;
        count: number;
    }>;
    verifyRegistration(domain: string): Promise<import("./index.js").DomainRegistrationVerification>;
    addons(input?: {
        type?: string;
    }): Promise<{
        addons: import("./index.js").DomainAddon[];
        count: number;
    }>;
    addon(id: string): Promise<{
        addon: import("./index.js").DomainAddon;
    }>;
    purchase(input: PurchaseDomainInput): Promise<import("./index.js").DomainPurchaseResult>;
    createAddonInvoice(domainId: string, addonIds: string[], currency?: DomainCurrency): Promise<unknown>;
    createOrder(input: {
        domains: string[];
        customerId?: number | string;
        contactId?: number | string;
    }): Promise<unknown>;
    listOrders(): Promise<{
        orders: import("./index.js").DomainOrder[];
        count: number;
    }>;
    getOrder(id: number | string): Promise<unknown>;
    updateOrderDuration(domainId: number | string, duration: number): Promise<unknown>;
    addOrderAddons(domainId: number | string, addonIds: string[]): Promise<unknown>;
    listOwned(teamId?: string): Promise<{
        domains: Array<import("./index.js").DomainSummary | string>;
        total?: number;
        success?: boolean;
    }>;
    check(domain: string, teamId?: string): Promise<unknown>;
    stats(domain: string, input?: {
        timeframe?: string;
        teamId?: string;
    }): Promise<unknown>;
    get(id: string, teamId?: string): Promise<unknown>;
    add(input: ConnectDomainInput): Promise<unknown>;
    connect(input: ConnectDomainInput): Promise<unknown>;
    connectMany(input: ConnectDomainInput[]): Promise<import("./index.js").ConnectDomainsResult>;
    remove(domain: string, input?: {
        projectId?: string;
        teamId?: string;
    }): Promise<unknown>;
    update(id: string, input: Parameters<PxxlClient["updateDomain"]>[1]): Promise<unknown>;
    verify(input: Parameters<PxxlClient["verifyDomainRecord"]>[0]): Promise<unknown>;
    dnsRecords(id: string, teamId?: string): Promise<unknown>;
    upsertDNSRecord(id: string, input: DomainDNSRecordInput & {
        teamId?: string;
    }): Promise<unknown>;
    replaceDNSRecords(id: string, input: DomainDNSRecordInput & {
        teamId?: string;
    }): Promise<unknown>;
    deleteDNSRecord(id: string, input: Parameters<PxxlClient["deleteDomainDNSRecord"]>[1]): Promise<unknown>;
    changeLogs(id: string, teamId?: string): Promise<unknown>;
    rollbackDNSChange(id: string, logId: string, teamId?: string): Promise<unknown>;
    updateNameservers(id: string, nameservers: string[], teamId?: string): Promise<unknown>;
    resetNameservers(id: string, teamId?: string): Promise<unknown>;
    verifyNameservers(id: string, teamId?: string): Promise<unknown>;
    zoneStatus(id: string, teamId?: string): Promise<unknown>;
    activate(id: string, teamId?: string): Promise<unknown>;
    resync(domain: string, input?: {
        teamId?: string;
    }): Promise<unknown>;
    downloadCertificate(id: string, teamId?: string): Promise<Blob>;
}
export declare class PxxlInvoices {
    private readonly client;
    constructor(client: PxxlClient);
    list(teamId?: string): Promise<{
        invoices: import("./index.js").DomainInvoice[];
        error?: boolean;
    }>;
    get(id: string, teamId?: string): Promise<{
        invoice: import("./index.js").DomainInvoice;
        registrations?: unknown[];
        grandTotal?: number;
        error?: boolean;
    }>;
    paymentUrl(id: string, currency?: DomainCurrency, teamId?: string): Promise<import("./index.js").PaymentUrl>;
    getPaymentUrl(id: string, currency?: DomainCurrency, teamId?: string): Promise<import("./index.js").PaymentUrl>;
    pay(id: string, teamId?: string): Promise<import("./index.js").PaymentUrl>;
    cancel(id: string, teamId?: string): Promise<unknown>;
    bachsPay(id: string, input?: {
        currency?: string;
        baseCurrency?: string;
        paymentMethod?: string;
        teamId?: string;
    }): Promise<unknown>;
    polarPay(id: string, teamId?: string): Promise<unknown>;
    purchasedDomains(): Promise<{
        domains: Array<Record<string, unknown>>;
        count: number;
    }>;
}
export declare class PxxlBilling {
    private readonly client;
    constructor(client: PxxlClient);
    list(input?: {
        status?: string;
        teamId?: string;
    }): Promise<import("./index.js").InvoiceListResult>;
    get(id: string, teamId?: string): Promise<import("./index.js").InvoiceDetailResult>;
    create(input: CreateInvoiceInput): Promise<import("./index.js").InvoiceDetailResult>;
    paymentLink(id: string): Promise<import("./index.js").PaymentLinkResult>;
}
export declare class PxxlCronJobs {
    private readonly client;
    constructor(client: PxxlClient);
    list(input?: {
        teamId?: string;
    }): Promise<{
        cronJobs: import("./index.js").CronJob[];
    }>;
    get(id: string, teamId?: string): Promise<import("./index.js").CronJob>;
    create(input: CreateCronJobInput): Promise<import("./index.js").CronJob>;
    update(id: string, input: UpdateCronJobInput): Promise<import("./index.js").CronJob>;
    delete(id: string, teamId?: string): Promise<unknown>;
    start(id: string, teamId?: string): Promise<unknown>;
    stop(id: string, teamId?: string): Promise<unknown>;
    trigger(id: string, teamId?: string): Promise<unknown>;
    runs(id: string, input?: {
        page?: number;
        limit?: number;
        teamId?: string;
    }): Promise<{
        runs: import("./index.js").CronJobRun[];
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
    }>;
    validateSchedule(schedule: string): Promise<unknown>;
    validateURL(url: string): Promise<unknown>;
}
export declare class PxxlProjects {
    private readonly client;
    constructor(client: PxxlClient);
    list(input?: {
        teamId?: string;
        page?: number;
        limit?: number;
    }): Promise<unknown>;
    get(id: string): Promise<{
        project?: import("./index.js").ProjectSummary;
        data?: import("./index.js").ProjectSummary;
        success?: boolean;
    } & Record<string, unknown>>;
    deployments(input?: {
        projectId?: string;
        page?: number;
        limit?: number;
        teamId?: string;
    }): Promise<unknown>;
    logs(id: string, input?: {
        lines?: number;
        live?: boolean;
        since?: string;
    }): Promise<unknown>;
    liveLogs(id: string, input?: {
        lines?: number;
        since?: string;
    }): Promise<unknown>;
}
export declare class PxxlDeployments {
    private readonly client;
    constructor(client: PxxlClient);
    list(input?: {
        projectId?: string;
        page?: number;
        limit?: number;
        teamId?: string;
    }): Promise<unknown>;
    get(id: string): Promise<unknown>;
    logs(id: string, input?: {
        build?: boolean;
        since?: string;
    }): Promise<unknown>;
    buildLogs(id: string, since?: string): Promise<unknown>;
    redeploy(id: string, input?: {
        commitSha?: string;
        commitMessage?: string;
    }): Promise<unknown>;
    deploy(input: Parameters<PxxlClient["deploy"]>[0]): Promise<unknown>;
}
export declare class PxxlTeams {
    private readonly client;
    constructor(client: PxxlClient);
    list(): Promise<{
        teams: import("./index.js").TeamSummary[];
        total: number;
    }>;
    get(id: string): Promise<{
        team: import("./index.js").TeamSummary;
        success?: boolean;
    }>;
}
export declare class PxxlDatabases {
    private readonly client;
    constructor(client: PxxlClient);
    list(teamId?: string): Promise<{
        databases: import("./index.js").DatabaseSummary[];
        total: number;
        success?: boolean;
    }>;
    get(id: string, teamId?: string): Promise<{
        database: import("./index.js").DatabaseSummary;
        success?: boolean;
    }>;
    create(input: CreateDatabaseInput): Promise<{
        database: import("./index.js").DatabaseSummary;
        success?: boolean;
    }>;
    update(id: string, input: UpdateDatabaseInput): Promise<{
        database: import("./index.js").DatabaseSummary;
        success?: boolean;
    }>;
    delete(id: string, teamId?: string): Promise<unknown>;
    start(id: string, teamId?: string): Promise<unknown>;
    stop(id: string, teamId?: string): Promise<unknown>;
    restart(id: string, teamId?: string): Promise<unknown>;
    stats(id: string, teamId?: string): Promise<unknown>;
    tables(id: string, teamId?: string): Promise<unknown>;
}
//# sourceMappingURL=resources.d.ts.map