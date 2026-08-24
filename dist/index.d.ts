import { PxxlAnalytics, PxxlAssets, PxxlBilling, PxxlCronJobs, PxxlCustomers, PxxlDatabases, PxxlDeployments, PxxlDomains, PxxlEnvironmentVariables, PxxlIdentity, PxxlInvoices, PxxlMCP, PxxlRawAPI, PxxlProjects, PxxlStorage, PxxlTeams } from "./resources.js";
export type CDNVisibility = "private" | "public";
export type CDNAssetKind = "file" | "artifact";
export declare const PXXL_API_BASE_URL = "https://server.pxxl.app/api/v3";
export declare const MAX_DEPLOY_FILES = 12000;
export declare const MAX_DEPLOY_SOURCE_BYTES: number;
export interface PxxlClientOptions {
    apiKey?: string;
    /** @deprecated The public SDK always uses the official Pxxl API base URL. */
    baseUrl?: string;
    teamId?: string;
    fetchImpl?: typeof fetch;
    mcpApiKey?: string;
    mcpEndpoint?: string;
}
export declare const PXXL_MCP_ENDPOINT = "https://mcp.pxxl.app/mcp";
export declare const PXXL_MCP_PROTOCOL_VERSION = "2025-06-18";
export interface PxxlRequestOptions extends RequestInit {
    skipContentType?: boolean;
}
export interface EdgeFunctionInput {
    name: string;
    projectId?: string;
    route?: string;
    runtime?: string;
    source?: string;
    status?: string;
    metadata?: Record<string, unknown>;
}
export type DomainCurrency = "NGN" | "USD";
export interface CustomerInput {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    organization?: string;
    address2?: string;
    isDefault?: boolean;
}
export interface Customer extends CustomerInput {
    id: number | string;
    userId?: string;
    createdAt?: string;
    updatedAt?: string;
}
export type UpdateCustomerInput = Partial<CustomerInput>;
export interface DomainPurchaseItem {
    domainName: string;
    tld?: string;
    name?: string;
    price?: string;
    years?: number;
    isFreeDomain?: boolean;
    addons?: Array<{
        id: string;
    }>;
    nameservers?: string[];
}
export interface DomainInvoiceContact {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    phonecc?: string;
    phonenum?: string;
    [key: string]: unknown;
}
export interface DomainInvoiceAddress {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    [key: string]: unknown;
}
export interface PurchaseDomainInput {
    domains: DomainPurchaseItem[];
    customerId?: number | string;
    contactId?: number | string;
    contact?: DomainInvoiceContact;
    address?: DomainInvoiceAddress;
    total?: string;
    currency?: DomainCurrency;
    teamId?: string;
}
export interface DomainAddon {
    id: string;
    name: string;
    description?: string;
    price?: number;
    priceDollar?: number;
    type?: string | null;
    [key: string]: unknown;
}
export interface PaymentUrl {
    paymentUrl: string;
    checkoutUrl?: string;
    reference?: string;
    invoiceId: string;
    currency?: DomainCurrency | string;
    paymentUrlExpiresAt?: string;
    [key: string]: unknown;
}
export interface DomainPurchaseResult {
    invoiceId: string;
    invoice: DomainInvoice;
    computedTotal?: number;
    taxAmount?: number;
    grandTotal?: number;
    currency?: DomainCurrency | string;
    domains?: DomainPurchaseItem[];
    domainErrors?: string[];
    [key: string]: unknown;
}
export interface DomainOrder {
    id: number | string;
    contactId?: number | null;
    status?: string;
    createdAt?: string;
    [key: string]: unknown;
}
export interface DomainRegistrationVerification {
    domain: DomainSearchResult;
    [key: string]: unknown;
}
export interface DomainDNSRecord {
    type: string;
    value: string[];
    ttl?: number;
}
export interface DomainDNSLookupResult {
    domain: string;
    nameservers?: string[];
    records: Record<string, DomainDNSRecord>;
    status: string;
    [key: string]: unknown;
}
export type StorageVisibility = "private" | "public";
export type StorageKeyPermission = "read" | "read_write";
export interface StorageBucket {
    id: string;
    userId?: string;
    name: string;
    slug?: string;
    visibility: StorageVisibility;
    status: string;
    storageLimitBytes?: number;
    bandwidthLimitBytes?: number;
    storageBytes?: number;
    bandwidthBytes?: number;
    objectCount?: number;
    metadata?: Record<string, unknown>;
    suspendedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
}
export interface StorageAccessKey {
    id: string;
    name: string;
    accessKeyId: string;
    secretAccessKey?: string;
    secretPrefix?: string;
    permission: StorageKeyPermission;
    status: string;
    endpoint: string;
    region: string;
    bucket: string;
    pathStyle: boolean;
    createdAt?: string;
    lastUsedAt?: string | null;
}
export interface StorageBucketAnalytics {
    requests: number;
    bandwidthBytes: number;
    uploadedBytes: number;
    downloadedBytes: number;
    uploadCount: number;
    downloadCount: number;
    objectCount: number;
    publicObjects: number;
    privateObjects: number;
    largestObjectBytes: number;
    averageObjectBytes: number;
    contentTypes: Record<string, number>;
    recentActivity: Array<Record<string, unknown>>;
    timeline?: Array<Record<string, unknown>>;
    storageExhaustion?: Record<string, unknown> | null;
    bandwidthExhaustion?: Record<string, unknown> | null;
}
export interface StorageBillingResponse {
    billing: Record<string, unknown>;
    entries: Array<Record<string, unknown>>;
    usageMonths?: Array<Record<string, unknown>>;
    invoices?: Array<Record<string, unknown>>;
}
export interface CreateStorageBucketInput {
    name: string;
    visibility?: StorageVisibility;
    region?: string;
    cacheMode?: string;
    versioning?: boolean;
}
export interface UpdateStorageBucketInput {
    name?: string;
    visibility?: StorageVisibility;
}
export interface CreateStorageAccessKeyInput {
    name?: string;
    permission?: StorageKeyPermission;
}
export type AnalyticsTimeframe = "24h" | "48h" | "72h" | "7d" | "30d" | string;
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
export interface CDNSpace {
    id: string;
    name: string;
    status: string;
    suspendedAt?: string | null;
}
export interface UploadAssetInput {
    file: Blob;
    fileName: string;
    visibility?: CDNVisibility;
    kind?: CDNAssetKind;
    projectId?: string;
    deploymentId?: string;
    bucketId?: string;
    path?: string;
}
export interface ListAssetsInput {
    page?: number;
    limit?: number;
    search?: string;
    kind?: CDNAssetKind;
    bucketId?: string;
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
    rejected: Array<{
        domain: string;
        status: number;
        message: string;
        details?: unknown;
    }>;
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
export interface InvoiceListItem {
    id: string;
    invoiceId?: string;
    invoiceNumber?: string;
    source?: string;
    type?: string;
    status: string;
    total?: number;
    taxAmount?: number;
    grandTotal?: number;
    currency?: string;
    paymentUrl?: string | null;
    expiresAt?: string;
    paidAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
}
export interface InvoiceListResult {
    invoices: InvoiceListItem[];
    count: number;
    error?: boolean;
}
export interface InvoiceDetailResult {
    invoice: Record<string, unknown>;
    domains?: unknown[];
    registrations?: unknown[];
    grandTotal?: number;
    source?: string;
    error?: boolean;
    [key: string]: unknown;
}
export interface CreateInvoiceInput {
    domainOrderId: number | string;
}
export interface PaymentLinkResult {
    paymentUrl?: string;
    authorizationUrl?: string;
    reference?: string;
    invoiceId?: string;
    [key: string]: unknown;
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
export declare class PxxlAPIError extends Error {
    status: number;
    details: unknown;
    constructor(message: string, status: number, details: unknown);
}
export declare class PxxlClient {
    private readonly apiKey?;
    private readonly baseUrl;
    private readonly teamId?;
    private readonly fetchImpl;
    constructor(options?: PxxlClientOptions);
    whoami(): Promise<unknown>;
    stats(teamId?: string | undefined): Promise<unknown>;
    platformUsage(teamId?: string | undefined): Promise<unknown>;
    summary(): Promise<CDNSummary>;
    getCDNSpace(): Promise<{
        space: CDNSpace;
        storageName?: string;
    }>;
    createCDNSpace(input?: {
        name?: string;
    }): Promise<{
        space: CDNSpace;
        storageName?: string;
    }>;
    listAssets(input?: ListAssetsInput): Promise<{
        assets: CDNAsset[];
        pagination: unknown;
    }>;
    uploadAsset(input: UploadAssetInput): Promise<CDNAsset>;
    downloadAsset(id: string): Promise<Blob>;
    deleteAsset(id: string): Promise<void>;
    listStorageObjects(bucketId: string, input?: Omit<ListAssetsInput, "bucketId">): Promise<{
        assets: CDNAsset[];
        pagination: unknown;
    }>;
    uploadStorageObject(bucketId: string, input: Omit<UploadAssetInput, "bucketId">): Promise<CDNAsset>;
    downloadStorageObject(id: string): Promise<Blob>;
    deleteStorageObject(id: string): Promise<void>;
    usage(limit?: number): Promise<unknown[]>;
    cdnProxyLogs(input?: {
        limit?: number;
        projectId?: string;
    }): Promise<unknown>;
    listEdgeFunctions(input?: {
        projectId?: string;
        status?: string;
        limit?: number;
    }): Promise<unknown>;
    createEdgeFunction(input: EdgeFunctionInput): Promise<unknown>;
    listStorageBuckets(): Promise<{
        buckets: StorageBucket[];
        total?: number;
        access?: unknown;
    }>;
    getStorageBucket(id: string): Promise<{
        bucket: StorageBucket;
        access?: unknown;
    }>;
    createStorageBucket(input: CreateStorageBucketInput): Promise<{
        bucket: StorageBucket;
        access?: unknown;
    }>;
    updateStorageBucket(id: string, input: UpdateStorageBucketInput): Promise<{
        bucket: StorageBucket;
        access?: unknown;
    }>;
    deleteStorageBucket(id: string): Promise<void>;
    storageAnalytics(id: string, timeframe?: string): Promise<StorageBucketAnalytics>;
    storageBilling(input?: {
        bucketId?: string;
        limit?: number;
    }): Promise<StorageBillingResponse>;
    listStorageAccessKeys(bucketId: string): Promise<{
        keys: StorageAccessKey[];
    }>;
    createStorageAccessKey(bucketId: string, input?: CreateStorageAccessKeyInput): Promise<{
        key: StorageAccessKey;
        notice?: string;
    }>;
    deleteStorageAccessKey(bucketId: string, keyId: string): Promise<void>;
    projectTraffic(projectId: string, input?: {
        timeframe?: AnalyticsTimeframe;
        domain?: string;
    }): Promise<unknown>;
    domainTraffic(domainId: string, input?: {
        timeframe?: AnalyticsTimeframe;
        teamId?: string;
    }): Promise<unknown>;
    userDomainTraffic(domain: string, timeframe?: AnalyticsTimeframe): Promise<unknown>;
    listTLDs(): Promise<{
        tlds: DomainTLD[];
        count: number;
    }>;
    popularTLDs(): Promise<{
        tlds: DomainTLD[];
        count: number;
    }>;
    searchTLDs(q: string): Promise<{
        tlds: DomainTLD[];
        count: number;
        query: string;
    }>;
    searchDomains(input: DomainSearchInput): Promise<{
        query: string;
        results: DomainSearchResult[];
        count: number;
        latency?: number;
        cached?: boolean;
    }>;
    getTLD(tld: string): Promise<{
        tld: DomainTLD;
    }>;
    listTLDTypes(): Promise<unknown>;
    listTLDsByType(type: string): Promise<unknown>;
    checkDomainAvailability(domain: string): Promise<unknown>;
    domainDNSLookup(domain: string, type?: string): Promise<DomainDNSLookupResult>;
    bulkDomainDNSLookup(domains: string[]): Promise<{
        results: Record<string, DomainDNSLookupResult>;
        count: number;
    }>;
    verifyDomainRegistration(domain: string): Promise<DomainRegistrationVerification>;
    listDomainAddons(input?: {
        type?: string;
    }): Promise<{
        addons: DomainAddon[];
        count: number;
    }>;
    getDomainAddon(id: string): Promise<{
        addon: DomainAddon;
    }>;
    purchaseDomain(input: PurchaseDomainInput): Promise<DomainPurchaseResult>;
    createDomainAddonInvoice(domainId: string, addonIds: string[], currency?: DomainCurrency): Promise<unknown>;
    createDomainOrder(input: {
        domains: string[];
        customerId?: number | string;
        contactId?: number | string;
    }): Promise<unknown>;
    listDomainOrders(): Promise<{
        orders: DomainOrder[];
        count: number;
    }>;
    getDomainOrder(id: number | string): Promise<unknown>;
    updateDomainOrderDuration(domainId: number | string, duration: number): Promise<unknown>;
    addDomainOrderAddons(domainId: number | string, addonIds: string[]): Promise<unknown>;
    createCustomer(input: CustomerInput): Promise<Customer>;
    listCustomers(): Promise<{
        customers: Customer[];
        count: number;
    }>;
    getCustomer(id: number | string): Promise<Customer>;
    updateCustomer(id: number | string, input: UpdateCustomerInput): Promise<Customer>;
    deleteCustomer(id: number | string): Promise<void>;
    listDomains(teamId?: string | undefined): Promise<{
        domains: Array<DomainSummary | string>;
        total?: number;
        success?: boolean;
    }>;
    domainStats(domain: string, input?: {
        timeframe?: string;
        teamId?: string;
    }): Promise<unknown>;
    checkDomain(domain: string, teamId?: string | undefined): Promise<unknown>;
    connectDomain(input: ConnectDomainInput): Promise<unknown>;
    connectDomains(input: ConnectDomainInput[]): Promise<ConnectDomainsResult>;
    verifyDomainRecord(input: VerifyDomainRecordInput): Promise<unknown>;
    verifyDomainDNSRecord(input: VerifyDomainRecordInput): Promise<unknown>;
    getDomain(id: string, teamId?: string | undefined): Promise<unknown>;
    updateDomain(id: string, input: DomainSettingsInput): Promise<unknown>;
    disconnectDomain(domain: string, input?: {
        projectId?: string;
        teamId?: string;
    }): Promise<unknown>;
    resyncDomainProxy(domain: string, input?: {
        teamId?: string;
    }): Promise<unknown>;
    domainInfraAction(domain: string, type: "resync" | "fetch" | "certificate" | "ssl", input?: {
        teamId?: string;
    }): Promise<unknown>;
    downloadDomainCertificate(id: string, teamId?: string | undefined): Promise<Blob>;
    listDomainDNSRecords(id: string, teamId?: string | undefined): Promise<unknown>;
    createDomainDNSRecord(id: string, input: DomainDNSRecordInput & {
        teamId?: string;
    }): Promise<unknown>;
    updateDomainDNSRecords(id: string, input: DomainDNSRecordInput & {
        teamId?: string;
    }): Promise<unknown>;
    deleteDomainDNSRecord(id: string, input: Pick<DomainDNSRecordInput, "id" | "recordId" | "zoneId"> & {
        teamId?: string;
    }): Promise<unknown>;
    listDomainDNSChangeLogs(id: string, teamId?: string | undefined): Promise<unknown>;
    rollbackDomainDNSChange(id: string, logId: string, teamId?: string | undefined): Promise<unknown>;
    createManagedSubdomain(id: string, input: ManagedSubdomainInput): Promise<unknown>;
    updateDomainNameservers(id: string, nameservers: string[], teamId?: string | undefined): Promise<unknown>;
    resetDomainNameservers(id: string, teamId?: string | undefined): Promise<unknown>;
    verifyDomainNameservers(id: string, teamId?: string | undefined): Promise<unknown>;
    getDomainZoneStatus(id: string, teamId?: string | undefined): Promise<unknown>;
    getDomainConnectionStatus(id: string, teamId?: string | undefined): Promise<unknown>;
    private getDomainZoneStatusRaw;
    switchDomainToPxxlDNS(id: string, teamId?: string | undefined): Promise<unknown>;
    activateDomain(id: string, teamId?: string | undefined): Promise<unknown>;
    listCronJobs(input?: {
        teamId?: string;
    }): Promise<{
        cronJobs: CronJob[];
    }>;
    createCronJob(input: CreateCronJobInput): Promise<CronJob>;
    getCronJob(id: string, teamId?: string | undefined): Promise<CronJob>;
    updateCronJob(id: string, input: UpdateCronJobInput): Promise<CronJob>;
    deleteCronJob(id: string, teamId?: string | undefined): Promise<unknown>;
    startCronJob(id: string, teamId?: string | undefined): Promise<unknown>;
    stopCronJob(id: string, teamId?: string | undefined): Promise<unknown>;
    triggerCronJob(id: string, teamId?: string | undefined): Promise<unknown>;
    listCronJobRuns(id: string, input?: {
        page?: number;
        limit?: number;
        teamId?: string;
    }): Promise<{
        runs: CronJobRun[];
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
    }>;
    validateCronSchedule(schedule: string): Promise<unknown>;
    validateCronURL(url: string): Promise<unknown>;
    listTeams(): Promise<{
        teams: TeamSummary[];
        total: number;
    }>;
    getTeam(id: string): Promise<{
        team: TeamSummary;
        success?: boolean;
    }>;
    listTeamDatabases(id: string): Promise<unknown>;
    listDatabases(teamId?: string | undefined): Promise<{
        databases: DatabaseSummary[];
        total: number;
        success?: boolean;
    }>;
    getDatabase(id: string, teamId?: string | undefined): Promise<{
        database: DatabaseSummary;
        success?: boolean;
    }>;
    createDatabase(input: CreateDatabaseInput): Promise<{
        database: DatabaseSummary;
        success?: boolean;
    }>;
    updateDatabase(id: string, input: UpdateDatabaseInput): Promise<{
        database: DatabaseSummary;
        success?: boolean;
    }>;
    deleteDatabase(id: string, teamId?: string | undefined): Promise<unknown>;
    startDatabase(id: string, teamId?: string | undefined): Promise<unknown>;
    stopDatabase(id: string, teamId?: string | undefined): Promise<unknown>;
    restartDatabase(id: string, teamId?: string | undefined): Promise<unknown>;
    databaseStats(id: string, teamId?: string | undefined): Promise<unknown>;
    databaseMetrics(id: string, teamId?: string | undefined): Promise<unknown>;
    databaseUsage(id: string, teamId?: string | undefined): Promise<unknown>;
    revealDatabaseCredential(id: string, field: string, teamId?: string | undefined): Promise<unknown>;
    databaseTables(id: string, teamId?: string | undefined): Promise<unknown>;
    getProject(id: string): Promise<{
        project?: ProjectSummary;
        data?: ProjectSummary;
        success?: boolean;
    } & Record<string, unknown>>;
    listProjects(input?: {
        teamId?: string;
        page?: number;
        limit?: number;
    } | string): Promise<unknown>;
    listDeployments(input?: {
        projectId?: string;
        page?: number;
        limit?: number;
        teamId?: string;
    }): Promise<unknown>;
    getDeployment(id: string): Promise<unknown>;
    projectLogs(id: string, input?: {
        lines?: number;
        live?: boolean;
        since?: string;
    }): Promise<unknown>;
    deploymentLogs(id: string, input?: {
        build?: boolean;
        since?: string;
    }): Promise<unknown>;
    deployDomainOptions(): Promise<unknown>;
    redeployProject(id: string, input?: RedeployInput): Promise<unknown>;
    pushProjectEnv(id: string, vars: EnvVarInput[], options?: {
        global?: boolean;
        replace?: boolean;
    }): Promise<unknown>;
    diffProjectEnv(id: string, vars: EnvVarInput[], options?: {
        global?: boolean;
    }): Promise<EnvDiffResult>;
    listProjectEnv(id: string, options?: {
        global?: boolean;
    }): Promise<unknown>;
    listDomainInvoices(teamId?: string | undefined): Promise<{
        invoices: DomainInvoice[];
        error?: boolean;
    }>;
    getDomainInvoice(id: string, teamId?: string | undefined): Promise<{
        invoice: DomainInvoice;
        registrations?: unknown[];
        grandTotal?: number;
        error?: boolean;
    }>;
    getDomainInvoicePaymentUrl(id: string, teamId?: string | undefined): Promise<unknown>;
    getPaymentUrl(id: string, currency?: DomainCurrency, teamId?: string | undefined): Promise<PaymentUrl>;
    payDomainInvoice(id: string, teamId?: string | undefined): Promise<PaymentUrl>;
    bachsPayDomainInvoice(id: string, input?: {
        currency?: string;
        baseCurrency?: string;
        paymentMethod?: string;
        teamId?: string;
    }): Promise<unknown>;
    polarPayDomainInvoice(id: string, teamId?: string | undefined): Promise<unknown>;
    listPurchasedDomains(): Promise<{
        domains: Array<Record<string, unknown>>;
        count: number;
    }>;
    listInvoices(input?: {
        status?: string;
        teamId?: string;
    }): Promise<InvoiceListResult>;
    getInvoice(id: string, teamId?: string | undefined): Promise<InvoiceDetailResult>;
    createInvoice(input: CreateInvoiceInput): Promise<InvoiceDetailResult>;
    createInvoicePaymentLink(id: string): Promise<PaymentLinkResult>;
    cancelDomainInvoice(id: string, teamId?: string | undefined): Promise<unknown>;
    deploy(input: DeployInput): Promise<unknown>;
    request<T = unknown>(path: string, init?: PxxlRequestOptions): Promise<T>;
    rawRequest(path: string, init?: PxxlRequestOptions): Promise<Response>;
    mcpRPC<T = Record<string, unknown>>(method: string, params?: Record<string, unknown>, endpoint?: string): Promise<T>;
}
export declare const PxxlCDN: typeof PxxlClient;
export declare const PxxlCDNError: typeof PxxlAPIError;
/**
 * Unified platform client. Flat PxxlClient methods remain available for
 * compatibility, while grouped resources keep larger integrations readable.
 */
export declare class Pxxl extends PxxlClient {
    readonly identity: PxxlIdentity;
    readonly api: PxxlRawAPI;
    readonly assets: PxxlAssets;
    readonly cdn: PxxlAssets;
    readonly storage: PxxlStorage;
    readonly analytics: PxxlAnalytics;
    readonly projects: PxxlProjects;
    readonly env: PxxlEnvironmentVariables;
    readonly environments: PxxlEnvironmentVariables;
    readonly deployments: PxxlDeployments;
    readonly domains: PxxlDomains;
    readonly customers: PxxlCustomers;
    readonly invoices: PxxlInvoices;
    readonly billing: PxxlBilling;
    readonly cronjobs: PxxlCronJobs;
    readonly cron: PxxlCronJobs;
    readonly teams: PxxlTeams;
    readonly databases: PxxlDatabases;
    readonly mcp: PxxlMCP;
    constructor(options?: PxxlClientOptions);
}
export { PxxlAnalytics, PxxlAssets, PxxlBilling, PxxlCronJobs, PxxlCustomers, PxxlDatabases, PxxlDeployments, PxxlDomains, PxxlEnvironmentVariables, PxxlIdentity, PxxlInvoices, PxxlMCP, PxxlRawAPI, PxxlProjects, PxxlStorage, PxxlTeams, };
export declare const defaultPxxlIgnore: string[];
export declare function createProjectZip(cwd: string): Promise<Uint8Array>;
export declare function readPxxlToml(cwd: string): Promise<DeployConfig>;
export declare function writeDefaultPxxlFiles(cwd: string, config: DeployConfig): Promise<void>;
export declare function copyBoilerplate(name: string, destination: string, repoRoot?: string): Promise<void>;
export declare function readBoilerplateManifest(name: string, repoRoot?: string): Promise<BoilerplateManifest | undefined>;
export declare function saveAuthConfig(apiKey: string, _baseUrl?: string): Promise<void>;
export declare function saveTeamSelection(teamId?: string): Promise<void>;
export declare function readAuthConfig(): Promise<{
    apiKey?: string;
    selectedTeamId?: string;
}>;
export declare function clearAuthConfig(): Promise<void>;
export declare function configPath(): string;
export declare function sha256Hex(bytes: Uint8Array): string;
//# sourceMappingURL=index.d.ts.map