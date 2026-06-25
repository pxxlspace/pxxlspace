export type CDNVisibility = "private" | "public";
export type CDNAssetKind = "file" | "artifact";
export declare const PXXL_API_BASE_URL = "https://gateway.pxxl.app/api/v3";
export declare const MAX_DEPLOY_FILES = 12000;
export declare const MAX_DEPLOY_SOURCE_BYTES: number;
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
    createdAt?: string;
}
export interface ConnectDomainInput {
    domain: string;
    projectId: string;
    alias?: boolean;
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
    listAssets(input?: ListAssetsInput): Promise<{
        assets: CDNAsset[];
        pagination: unknown;
    }>;
    uploadAsset(input: UploadAssetInput): Promise<CDNAsset>;
    downloadAsset(id: string): Promise<Blob>;
    deleteAsset(id: string): Promise<void>;
    usage(limit?: number): Promise<unknown[]>;
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
    getDomain(id: string, teamId?: string | undefined): Promise<unknown>;
    updateDomain(id: string, input: DomainSettingsInput): Promise<unknown>;
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
    switchDomainToPxxlDNS(id: string, teamId?: string | undefined): Promise<unknown>;
    activateDomain(id: string, teamId?: string | undefined): Promise<unknown>;
    listTeams(): Promise<{
        teams: TeamSummary[];
        total: number;
    }>;
    getTeam(id: string): Promise<{
        team: TeamSummary;
        success?: boolean;
    }>;
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
    cancelDomainInvoice(id: string, teamId?: string | undefined): Promise<unknown>;
    deploy(input: DeployInput): Promise<unknown>;
    private request;
    private rawRequest;
}
export declare const PxxlCDN: typeof PxxlClient;
export declare const PxxlCDNError: typeof PxxlAPIError;
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