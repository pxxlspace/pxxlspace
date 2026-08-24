import { access, chmod, copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, basename } from "node:path";
import { zipSync } from "fflate";
import ignore from "ignore";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { PxxlAnalytics, PxxlAssets, PxxlBilling, PxxlCronJobs, PxxlCustomers, PxxlDatabases, PxxlDeployments, PxxlDomains, PxxlEnvironmentVariables, PxxlIdentity, PxxlInvoices, PxxlMCP, PxxlRawAPI, PxxlProjects, PxxlStorage, PxxlTeams, } from "./resources.js";
export const PXXL_API_BASE_URL = "https://server.pxxl.app/api/v3";
export const MAX_DEPLOY_FILES = 12000;
export const MAX_DEPLOY_SOURCE_BYTES = 220 * 1024 * 1024;
export const PXXL_MCP_ENDPOINT = "https://mcp.pxxl.app/mcp";
export const PXXL_MCP_PROTOCOL_VERSION = "2025-06-18";
export class PxxlAPIError extends Error {
    status;
    details;
    constructor(message, status, details) {
        super(message);
        this.name = "PxxlAPIError";
        this.status = status;
        this.details = details;
    }
}
function readStringPath(value, path) {
    let current = value;
    for (const key of path) {
        if (!current || typeof current !== "object" || !(key in current))
            return undefined;
        current = current[key];
    }
    return typeof current === "string" && current.trim() ? current.trim() : undefined;
}
function domainNameFromResponse(value) {
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
        if (candidate)
            return candidate.toLowerCase().replace(/\.$/, "");
    }
    return "";
}
function isCvDomainName(domain) {
    return domain.toLowerCase().replace(/\.$/, "").endsWith(".cv");
}
function isCvZoneOnlyError(error) {
    return error instanceof PxxlAPIError && /zone status .*only available for \.cv domains/i.test(error.message);
}
export class PxxlClient {
    apiKey;
    baseUrl;
    teamId;
    fetchImpl;
    constructor(options = {}) {
        this.apiKey = (options.apiKey || "").trim() || undefined;
        this.baseUrl = PXXL_API_BASE_URL;
        this.teamId = (options.teamId || "").trim() || undefined;
        this.fetchImpl = options.fetchImpl || fetch;
    }
    async whoami() {
        return this.request("/cli/whoami");
    }
    async stats(teamId = this.teamId) {
        return this.request(`/cli/stats${teamQuery(teamId)}`);
    }
    async platformUsage(teamId = this.teamId) {
        return this.request(`/cli/usage${teamQuery(teamId)}`);
    }
    async summary() {
        const response = await this.request("/cdn/summary");
        return response.data;
    }
    async getCDNSpace() {
        return this.request("/cdn/space");
    }
    async createCDNSpace(input = {}) {
        return this.request("/cdn/space", { method: "POST", body: JSON.stringify(input) });
    }
    async listAssets(input = {}) {
        const params = new URLSearchParams();
        Object.entries(input).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "")
                params.set(key, String(value));
        });
        const suffix = params.size ? `?${params.toString()}` : "";
        return this.request(`/cdn/assets${suffix}`);
    }
    async uploadAsset(input) {
        if (!input.fileName || !input.fileName.trim())
            throw new Error("uploadAsset requires fileName");
        const form = new FormData();
        form.append("file", input.file, input.fileName);
        form.append("visibility", input.visibility || "public");
        if (input.kind)
            form.append("kind", input.kind);
        if (input.projectId)
            form.append("projectId", input.projectId);
        if (input.deploymentId)
            form.append("deploymentId", input.deploymentId);
        if (input.bucketId)
            form.append("bucketId", input.bucketId);
        if (input.path)
            form.append("path", input.path);
        const response = await this.request("/cdn/assets", { method: "POST", body: form, skipContentType: true });
        return response.asset;
    }
    async downloadAsset(id) {
        const response = await this.rawRequest(`/cdn/assets/${encodeURIComponent(id)}/download`);
        return response.blob();
    }
    async deleteAsset(id) {
        await this.request(`/cdn/assets/${encodeURIComponent(id)}`, { method: "DELETE" });
    }
    async listStorageObjects(bucketId, input = {}) {
        return this.listAssets({ ...input, bucketId });
    }
    async uploadStorageObject(bucketId, input) {
        return this.uploadAsset({ ...input, bucketId });
    }
    async downloadStorageObject(id) {
        return this.downloadAsset(id);
    }
    async deleteStorageObject(id) {
        return this.deleteAsset(id);
    }
    async usage(limit = 100) {
        const response = await this.request(`/cdn/usage?limit=${encodeURIComponent(limit)}`);
        return response.events;
    }
    async cdnProxyLogs(input = {}) {
        return this.request(`/cdn/proxy-logs${queryString(input)}`);
    }
    async listEdgeFunctions(input = {}) {
        return this.request(`/cdn/edge-functions${queryString(input)}`);
    }
    async createEdgeFunction(input) {
        return this.request("/cdn/edge-functions", { method: "POST", body: JSON.stringify(input) });
    }
    async listStorageBuckets() {
        return this.request("/storage/buckets");
    }
    async getStorageBucket(id) {
        return this.request(`/storage/buckets/${encodeURIComponent(id)}`);
    }
    async createStorageBucket(input) {
        return this.request("/storage/buckets", { method: "POST", body: JSON.stringify(input) });
    }
    async updateStorageBucket(id, input) {
        return this.request(`/storage/buckets/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
    }
    async deleteStorageBucket(id) {
        await this.request(`/storage/buckets/${encodeURIComponent(id)}`, { method: "DELETE" });
    }
    async storageAnalytics(id, timeframe = "30d") {
        const result = await this.request(`/storage/buckets/${encodeURIComponent(id)}/analytics?timeframe=${encodeURIComponent(timeframe)}`);
        return result.analytics;
    }
    async storageBilling(input = {}) {
        return this.request(`/storage/billing${querySuffix(input)}`);
    }
    async listStorageAccessKeys(bucketId) {
        const result = await this.request(`/storage/buckets/${encodeURIComponent(bucketId)}/access-keys`);
        return Array.isArray(result) ? { keys: result } : result;
    }
    async createStorageAccessKey(bucketId, input = {}) {
        return this.request(`/storage/buckets/${encodeURIComponent(bucketId)}/access-keys`, { method: "POST", body: JSON.stringify(input) });
    }
    async deleteStorageAccessKey(bucketId, keyId) {
        await this.request(`/storage/buckets/${encodeURIComponent(bucketId)}/access-keys/${encodeURIComponent(keyId)}`, { method: "DELETE" });
    }
    async projectTraffic(projectId, input = {}) {
        return this.request(`/projects/${encodeURIComponent(projectId)}/analytics/traffic${querySuffix(input)}`);
    }
    async domainTraffic(domainId, input = {}) {
        return this.request(`/domains/my/${encodeURIComponent(domainId)}/analytics${querySuffix(input)}`);
    }
    async userDomainTraffic(domain, timeframe = "24h") {
        return this.request(`/user/analytics${querySuffix({ domain, timeframe })}`);
    }
    async listTLDs() {
        return this.request("/domains/tlds");
    }
    async popularTLDs() {
        return this.request("/domains/tlds/popular");
    }
    async searchTLDs(q) {
        return this.request(`/domains/tlds/search?q=${encodeURIComponent(q)}`);
    }
    async searchDomains(input) {
        return this.request("/domains/search", { method: "POST", body: JSON.stringify(input) });
    }
    async getTLD(tld) {
        return this.request(`/domains/tlds/${encodeURIComponent(tld)}`);
    }
    async listTLDTypes() {
        return this.request("/domains/types");
    }
    async listTLDsByType(type) {
        return this.request(`/domains/types/${encodeURIComponent(type)}/tlds`);
    }
    async checkDomainAvailability(domain) {
        return this.request("/domains/check-availability", { method: "POST", body: JSON.stringify({ domain }) });
    }
    async domainDNSLookup(domain, type) {
        return this.request("/domains/dns/lookup", {
            method: "POST",
            body: JSON.stringify({ domain, ...(type ? { type } : {}) }),
        });
    }
    async bulkDomainDNSLookup(domains) {
        return this.request("/domains/dns/bulk-lookup", { method: "POST", body: JSON.stringify({ domains }) });
    }
    async verifyDomainRegistration(domain) {
        return this.request("/domains/verify-registration", { method: "POST", body: JSON.stringify({ domain }) });
    }
    async listDomainAddons(input = {}) {
        return this.request(`/cli/domains/addons${querySuffix(input)}`);
    }
    async getDomainAddon(id) {
        return this.request(`/cli/domains/addons/${encodeURIComponent(id)}`);
    }
    async purchaseDomain(input) {
        const payload = { ...input };
        const customerId = input.customerId ?? input.contactId;
        delete payload.customerId;
        if (customerId !== undefined) {
            payload.contactId = typeof customerId === "string" && /^\d+$/.test(customerId) ? Number(customerId) : customerId;
        }
        const result = await this.request("/cli/domainprovider/domain/register", { method: "POST", body: JSON.stringify(payload) });
        return {
            ...result.data,
            invoice: result.data.invoice ?? { id: result.data.invoiceId, status: "pending" },
        };
    }
    async createDomainAddonInvoice(domainId, addonIds, currency = "NGN") {
        const result = await this.request(`/cli/domainprovider/domain/${encodeURIComponent(domainId)}/addons/invoice`, { method: "POST", body: JSON.stringify({ addonIds, currency }) });
        return result.data;
    }
    async createDomainOrder(input) {
        const contactId = input.contactId ?? input.customerId;
        return this.request("/cli/domain-orders", { method: "POST", body: JSON.stringify({ domains: input.domains, contactId }) });
    }
    async listDomainOrders() {
        return this.request("/cli/domain-orders");
    }
    async getDomainOrder(id) {
        return this.request(`/cli/domain-orders/${encodeURIComponent(id)}`);
    }
    async updateDomainOrderDuration(domainId, duration) {
        return this.request(`/cli/domain-orders/domains/${encodeURIComponent(domainId)}/duration`, { method: "PUT", body: JSON.stringify({ duration }) });
    }
    async addDomainOrderAddons(domainId, addonIds) {
        return this.request(`/cli/domain-orders/domains/${encodeURIComponent(domainId)}/addons`, { method: "POST", body: JSON.stringify({ addonIds }) });
    }
    async createCustomer(input) {
        const result = await this.request("/cli/contacts", { method: "POST", body: JSON.stringify(input) });
        return result.contact;
    }
    async listCustomers() {
        const result = await this.request("/cli/contacts");
        return { customers: result.contacts, count: result.count };
    }
    async getCustomer(id) {
        const result = await this.request(`/cli/contacts/${encodeURIComponent(id)}`);
        return result.contact;
    }
    async updateCustomer(id, input) {
        const result = await this.request(`/cli/contacts/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) });
        return result.contact;
    }
    async deleteCustomer(id) {
        await this.request(`/cli/contacts/${encodeURIComponent(id)}`, { method: "DELETE" });
    }
    async listDomains(teamId = this.teamId) {
        return this.request(`/cli/domains${teamQuery(teamId)}`);
    }
    async domainStats(domain, input = {}) {
        const params = new URLSearchParams();
        if (input.timeframe)
            params.set("timeframe", input.timeframe);
        const teamId = input.teamId || this.teamId;
        if (teamId)
            params.set("teamId", teamId);
        const suffix = params.size ? `?${params.toString()}` : "";
        return this.request(`/cli/domains/${encodeURIComponent(domain)}/stats${suffix}`);
    }
    async checkDomain(domain, teamId = this.teamId) {
        return this.request(`/cli/domains/${encodeURIComponent(domain)}/check${teamQuery(teamId)}`);
    }
    async connectDomain(input) {
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
    async connectDomains(input) {
        const result = { accepted: [], rejected: [], attempted: input.length };
        for (const item of input) {
            try {
                result.accepted.push(await this.connectDomain(item));
            }
            catch (error) {
                if (error instanceof PxxlAPIError) {
                    result.rejected.push({ domain: item.domain, status: error.status, message: error.message, details: error.details });
                    continue;
                }
                throw error;
            }
        }
        return result;
    }
    async verifyDomainRecord(input) {
        const teamId = input.teamId || this.teamId;
        return this.request(`/cli/domains/checkrecord${teamQuery(teamId)}`, {
            method: "POST",
            body: JSON.stringify({ domain: input.domain, projectId: input.projectId, teamId }),
        });
    }
    async verifyDomainDNSRecord(input) {
        return this.verifyDomainRecord(input);
    }
    async getDomain(id, teamId = this.teamId) {
        return this.request(`/cli/domains/${encodeURIComponent(id)}${teamQuery(teamId)}`);
    }
    async updateDomain(id, input) {
        const teamId = input.teamId || this.teamId;
        const { teamId: _teamId, ...body } = input;
        return this.request(`/cli/domains/${encodeURIComponent(id)}${teamQuery(teamId)}`, { method: "PATCH", body: JSON.stringify(body) });
    }
    async disconnectDomain(domain, input = {}) {
        const params = new URLSearchParams();
        const teamId = input.teamId || this.teamId;
        if (input.projectId)
            params.set("projectId", input.projectId);
        if (teamId)
            params.set("teamId", teamId);
        const suffix = params.size ? `?${params.toString()}` : "";
        return this.request(`/cli/domains/${encodeURIComponent(domain)}${suffix}`, { method: "DELETE" });
    }
    async resyncDomainProxy(domain, input = {}) {
        return this.request(`/cli/domains/${encodeURIComponent(domain)}/resync${teamQuery(input.teamId || this.teamId)}`, {
            method: "POST",
            body: JSON.stringify({}),
        });
    }
    async domainInfraAction(domain, type, input = {}) {
        return this.request(`/cli/domains/${encodeURIComponent(domain)}/infra/${encodeURIComponent(type)}${teamQuery(input.teamId || this.teamId)}`, {
            method: "POST",
            body: JSON.stringify({}),
        });
    }
    async downloadDomainCertificate(id, teamId = this.teamId) {
        const response = await this.rawRequest(`/cli/domains/${encodeURIComponent(id)}/certificate/download${teamQuery(teamId)}`);
        return response.blob();
    }
    async listDomainDNSRecords(id, teamId = this.teamId) {
        return this.request(`/cli/domains/${encodeURIComponent(id)}/dns-records${teamQuery(teamId)}`);
    }
    async createDomainDNSRecord(id, input) {
        const teamId = input.teamId || this.teamId;
        const { teamId: _teamId, ...body } = input;
        return this.request(`/cli/domains/${encodeURIComponent(id)}/dns-records${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify(body) });
    }
    async updateDomainDNSRecords(id, input) {
        const teamId = input.teamId || this.teamId;
        const { teamId: _teamId, ...body } = input;
        return this.request(`/cli/domains/${encodeURIComponent(id)}/dns-records${teamQuery(teamId)}`, { method: "PUT", body: JSON.stringify(body) });
    }
    async deleteDomainDNSRecord(id, input) {
        const teamId = input.teamId || this.teamId;
        const { teamId: _teamId, ...body } = input;
        return this.request(`/cli/domains/${encodeURIComponent(id)}/dns-records${teamQuery(teamId)}`, { method: "DELETE", body: JSON.stringify(body) });
    }
    async listDomainDNSChangeLogs(id, teamId = this.teamId) {
        return this.request(`/cli/domains/${encodeURIComponent(id)}/dns-change-logs${teamQuery(teamId)}`);
    }
    async rollbackDomainDNSChange(id, logId, teamId = this.teamId) {
        return this.request(`/cli/domains/${encodeURIComponent(id)}/dns-change-logs/${encodeURIComponent(logId)}/rollback${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
    }
    async createManagedSubdomain(id, input) {
        const teamId = input.teamId || this.teamId;
        return this.request(`/cli/domains/${encodeURIComponent(id)}/subdomains${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({ ...input, teamId }) });
    }
    async updateDomainNameservers(id, nameservers, teamId = this.teamId) {
        return this.request(`/cli/domains/${encodeURIComponent(id)}/nameservers${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({ nameservers }) });
    }
    async resetDomainNameservers(id, teamId = this.teamId) {
        return this.request(`/cli/domains/${encodeURIComponent(id)}/nameservers/reset${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
    }
    async verifyDomainNameservers(id, teamId = this.teamId) {
        return this.request(`/cli/domains/${encodeURIComponent(id)}/nameservers/verify${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
    }
    async getDomainZoneStatus(id, teamId = this.teamId) {
        return this.getDomainConnectionStatus(id, teamId);
    }
    async getDomainConnectionStatus(id, teamId = this.teamId) {
        const domain = await this.getDomain(id, teamId);
        const name = domainNameFromResponse(domain);
        if (isCvDomainName(name)) {
            try {
                return await this.getDomainZoneStatusRaw(id, teamId);
            }
            catch (error) {
                if (!isCvZoneOnlyError(error))
                    throw error;
            }
        }
        return this.activateDomain(id, teamId);
    }
    async getDomainZoneStatusRaw(id, teamId = this.teamId) {
        return this.request(`/cli/domains/${encodeURIComponent(id)}/zone-status${teamQuery(teamId)}`);
    }
    async switchDomainToPxxlDNS(id, teamId = this.teamId) {
        return this.request(`/cli/domains/${encodeURIComponent(id)}/switch-to-pxxl-dns${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
    }
    async activateDomain(id, teamId = this.teamId) {
        return this.request(`/cli/domains/${encodeURIComponent(id)}/activate${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
    }
    async listCronJobs(input = {}) {
        return this.request(`/cli/cronjobs${teamQuery(input.teamId || this.teamId)}`);
    }
    async createCronJob(input) {
        const teamId = input.teamId || this.teamId;
        const { teamId: _teamId, ...body } = input;
        return this.request(`/cli/cronjobs${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify(body) });
    }
    async getCronJob(id, teamId = this.teamId) {
        return this.request(`/cli/cronjobs/${encodeURIComponent(id)}${teamQuery(teamId)}`);
    }
    async updateCronJob(id, input) {
        const teamId = input.teamId || this.teamId;
        const { teamId: _teamId, ...body } = input;
        return this.request(`/cli/cronjobs/${encodeURIComponent(id)}${teamQuery(teamId)}`, { method: "PUT", body: JSON.stringify(body) });
    }
    async deleteCronJob(id, teamId = this.teamId) {
        return this.request(`/cli/cronjobs/${encodeURIComponent(id)}${teamQuery(teamId)}`, { method: "DELETE" });
    }
    async startCronJob(id, teamId = this.teamId) {
        return this.request(`/cli/cronjobs/${encodeURIComponent(id)}/start${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
    }
    async stopCronJob(id, teamId = this.teamId) {
        return this.request(`/cli/cronjobs/${encodeURIComponent(id)}/stop${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
    }
    async triggerCronJob(id, teamId = this.teamId) {
        return this.request(`/cli/cronjobs/${encodeURIComponent(id)}/trigger${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
    }
    async listCronJobRuns(id, input = {}) {
        const params = new URLSearchParams();
        if (input.page)
            params.set("page", String(input.page));
        if (input.limit)
            params.set("limit", String(input.limit));
        const teamId = input.teamId || this.teamId;
        if (teamId)
            params.set("teamId", teamId);
        const suffix = params.size ? `?${params.toString()}` : "";
        return this.request(`/cli/cronjobs/${encodeURIComponent(id)}/runs${suffix}`);
    }
    async validateCronSchedule(schedule) {
        return this.request("/cli/cronjobs/validate-schedule", { method: "POST", body: JSON.stringify({ schedule }) });
    }
    async validateCronURL(url) {
        return this.request("/cli/cronjobs/validate-url", { method: "POST", body: JSON.stringify({ url }) });
    }
    async listTeams() {
        return this.request("/teams");
    }
    async getTeam(id) {
        return this.request(`/teams/${encodeURIComponent(id)}`);
    }
    async listTeamDatabases(id) {
        return this.request(`/teams/${encodeURIComponent(id)}/databases`);
    }
    async listDatabases(teamId = this.teamId) {
        return this.request(`/databases${teamQuery(teamId)}`);
    }
    async getDatabase(id, teamId = this.teamId) {
        return this.request(`/databases/${encodeURIComponent(id)}${teamQuery(teamId)}`);
    }
    async createDatabase(input) {
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
    async updateDatabase(id, input) {
        return this.request(`/databases/${encodeURIComponent(id)}${teamQuery(input.teamId || this.teamId)}`, { method: "PATCH", body: JSON.stringify({ name: input.name, description: input.description }) });
    }
    async deleteDatabase(id, teamId = this.teamId) {
        return this.request(`/databases/${encodeURIComponent(id)}${teamQuery(teamId)}`, { method: "DELETE" });
    }
    async startDatabase(id, teamId = this.teamId) {
        return this.request(`/databases/${encodeURIComponent(id)}/start${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
    }
    async stopDatabase(id, teamId = this.teamId) {
        return this.request(`/databases/${encodeURIComponent(id)}/stop${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
    }
    async restartDatabase(id, teamId = this.teamId) {
        return this.request(`/databases/${encodeURIComponent(id)}/restart${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
    }
    async databaseStats(id, teamId = this.teamId) {
        return this.request(`/databases/${encodeURIComponent(id)}/stats${teamQuery(teamId)}`);
    }
    async databaseMetrics(id, teamId = this.teamId) {
        return this.request(`/databases/${encodeURIComponent(id)}/metrics${teamQuery(teamId)}`);
    }
    async databaseUsage(id, teamId = this.teamId) {
        return this.request(`/databases/${encodeURIComponent(id)}/usage${teamQuery(teamId)}`);
    }
    async revealDatabaseCredential(id, field, teamId = this.teamId) {
        return this.request(`/databases/${encodeURIComponent(id)}/credentials/${encodeURIComponent(field)}${teamQuery(teamId)}`);
    }
    async databaseTables(id, teamId = this.teamId) {
        return this.request(`/databases/${encodeURIComponent(id)}/tables${teamQuery(teamId)}`);
    }
    async getProject(id) {
        return this.request(`/cli/projects/${encodeURIComponent(id)}`);
    }
    async listProjects(input = {}) {
        const options = typeof input === "string" ? { teamId: input } : input;
        const params = new URLSearchParams();
        if (options.page)
            params.set("page", String(options.page));
        if (options.limit)
            params.set("limit", String(options.limit));
        const teamId = options.teamId || this.teamId;
        if (teamId)
            params.set("teamId", teamId);
        const suffix = params.size ? `?${params.toString()}` : "";
        return this.request(`/cli/projects${suffix}`);
    }
    async listDeployments(input = {}) {
        const params = new URLSearchParams();
        if (input.page)
            params.set("page", String(input.page));
        if (input.limit)
            params.set("limit", String(input.limit));
        const teamId = input.teamId || this.teamId;
        if (teamId)
            params.set("teamId", teamId);
        const suffix = params.size ? `?${params.toString()}` : "";
        if (input.projectId)
            return this.request(`/cli/projects/${encodeURIComponent(input.projectId)}/deployments${suffix}`);
        return this.request(`/cli/deployments${suffix}`);
    }
    async getDeployment(id) {
        return this.request(`/cli/deployments/${encodeURIComponent(id)}`);
    }
    async projectLogs(id, input = {}) {
        const params = new URLSearchParams();
        if (input.lines)
            params.set(input.live ? "tail" : "lines", String(input.lines));
        if (input.since)
            params.set("since", input.since);
        const suffix = params.size ? `?${params.toString()}` : "";
        const path = input.live ? "live-logs" : "logs";
        return this.request(`/cli/projects/${encodeURIComponent(id)}/${path}${suffix}`);
    }
    async deploymentLogs(id, input = {}) {
        const params = new URLSearchParams();
        if (input.since)
            params.set("since", input.since);
        const suffix = params.size ? `?${params.toString()}` : "";
        const path = input.build === false ? "logs" : "build-logs";
        return this.request(`/cli/deployments/${encodeURIComponent(id)}/${path}${suffix}`);
    }
    async deployDomainOptions() {
        return this.request("/cli/domains/deploy-options");
    }
    async redeployProject(id, input = {}) {
        return this.request(`/cli/projects/${encodeURIComponent(id)}/redeploy`, { method: "POST", body: JSON.stringify(input) });
    }
    async pushProjectEnv(id, vars, options = {}) {
        const path = options.global ? `/cli/projects/${encodeURIComponent(id)}/global-envs/bulk` : `/cli/projects/${encodeURIComponent(id)}/envs/bulk`;
        return this.request(path, { method: "POST", body: JSON.stringify({ vars, replace: Boolean(options.replace) }) });
    }
    async diffProjectEnv(id, vars, options = {}) {
        const path = options.global ? `/cli/projects/${encodeURIComponent(id)}/global-envs/diff` : `/cli/projects/${encodeURIComponent(id)}/envs/diff`;
        return this.request(path, { method: "POST", body: JSON.stringify({ vars }) });
    }
    async listProjectEnv(id, options = {}) {
        const path = options.global ? `/cli/projects/${encodeURIComponent(id)}/global-envs` : `/cli/projects/${encodeURIComponent(id)}/envs`;
        return this.request(path);
    }
    async listDomainInvoices(teamId = this.teamId) {
        return this.request(`/cli/domainprovider/invoices${teamQuery(teamId)}`);
    }
    async getDomainInvoice(id, teamId = this.teamId) {
        return this.request(`/cli/domainprovider/invoice/${encodeURIComponent(id)}${teamQuery(teamId)}`);
    }
    async getDomainInvoicePaymentUrl(id, teamId = this.teamId) {
        return this.request(`/cli/domainprovider/invoice/${encodeURIComponent(id)}/payment-url${teamQuery(teamId)}`);
    }
    async getPaymentUrl(id, currency, teamId = this.teamId) {
        const result = await this.request(`/cli/domainprovider/invoice/${encodeURIComponent(id)}/payment-url${querySuffix({ currency, teamId })}`);
        return result.data ?? result;
    }
    async payDomainInvoice(id, teamId = this.teamId) {
        const result = await this.request("/cli/domainprovider/invoice/pay", { method: "POST", body: JSON.stringify({ invoiceId: id, ...(teamId ? { teamId } : {}) }) });
        return result.data ?? result;
    }
    async bachsPayDomainInvoice(id, input = {}) {
        return this.request("/cli/domainprovider/invoice/bachs-pay", { method: "POST", body: JSON.stringify({ invoiceId: id, ...input }) });
    }
    async polarPayDomainInvoice(id, teamId = this.teamId) {
        return this.request("/cli/domainprovider/invoice/polar-pay", { method: "POST", body: JSON.stringify({ invoiceId: id, ...(teamId ? { teamId } : {}) }) });
    }
    async listPurchasedDomains() {
        return this.request("/cli/purchased-domains");
    }
    async listInvoices(input = {}) {
        return this.request(`/cli/invoices${querySuffix(input)}`);
    }
    async getInvoice(id, teamId = this.teamId) {
        return this.request(`/cli/invoices/${encodeURIComponent(id)}${teamQuery(teamId)}`);
    }
    async createInvoice(input) {
        return this.request("/cli/invoices", { method: "POST", body: JSON.stringify(input) });
    }
    async createInvoicePaymentLink(id) {
        return this.request(`/cli/invoices/${encodeURIComponent(id)}/payment-link`, { method: "POST", body: JSON.stringify({}) });
    }
    async cancelDomainInvoice(id, teamId = this.teamId) {
        return this.request(`/cli/domainprovider/invoice/${encodeURIComponent(id)}/cancel${teamQuery(teamId)}`, { method: "POST", body: JSON.stringify({}) });
    }
    async deploy(input) {
        const cwd = resolve(input.cwd || process.cwd());
        const config = { ...(await readPxxlToml(cwd)), ...input };
        const archive = input.archivePath ? await readFile(input.archivePath) : await createProjectZip(cwd);
        const form = new FormData();
        const archiveBytes = archive instanceof Uint8Array ? archive : new Uint8Array(archive);
        const archivePart = archiveBytes.buffer.slice(archiveBytes.byteOffset, archiveBytes.byteOffset + archiveBytes.byteLength);
        form.append("file", new Blob([archivePart]), basename(input.archivePath || "pxxl-source.zip"));
        if (config.projectId)
            form.append("projectId", config.projectId);
        if (config.projectId) {
            if (config.name)
                form.append("name", config.name);
            if (config.domainChoice)
                form.append("domainChoice", config.domainChoice);
        }
        else {
            form.append("name", requiredConfig(config.name, "name"));
            form.append("domainChoice", requiredConfig(config.domainChoice, "domainChoice"));
        }
        form.append("environment", config.environment || "production");
        form.append("sourceShape", "clideploy");
        form.append("deploymentSource", "clideploy");
        for (const key of ["deployEnvironment", "port", "language", "framework", "packageManager", "installCommand", "buildCommand", "startCommand", "baseDirectory", "entryFile", "commitMessage"]) {
            const value = config[key];
            if (value !== undefined && value !== null && value !== "")
                form.append(key, String(value));
        }
        return this.request("/projects/spacedrop", { method: "POST", body: form, skipContentType: true });
    }
    async request(path, init = {}) {
        if (!path.startsWith("/"))
            throw new Error("Pxxl request path must start with /");
        const response = await this.rawRequest(path, init);
        const data = await response.json().catch(() => ({}));
        return data;
    }
    async rawRequest(path, init = {}) {
        if (!path.startsWith("/"))
            throw new Error("Pxxl request path must start with /");
        const headers = new Headers(init.headers);
        if (this.apiKey)
            headers.set("Authorization", `Bearer ${this.apiKey}`);
        if (!init.skipContentType && init.body && !headers.has("Content-Type"))
            headers.set("Content-Type", "application/json");
        let response;
        try {
            response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
        }
        catch (error) {
            const cause = error instanceof Error && error.message ? ` (${error.message})` : "";
            throw new PxxlAPIError(`Could not reach Pxxl Gateway${cause}. Check your internet connection and try again.`, 0, { cause: error instanceof Error ? error.message : String(error) });
        }
        if (!response.ok) {
            let details = null;
            try {
                details = await response.json();
            }
            catch {
                details = await response.text().catch(() => "");
            }
            const message = typeof details === "object" && details && "message" in details ? String(details.message) : `Pxxl request failed with ${response.status}`;
            throw new PxxlAPIError(message, response.status, details);
        }
        return response;
    }
    async mcpRPC(method, params, endpoint = PXXL_MCP_ENDPOINT) {
        if (!this.apiKey)
            throw new Error("Pxxl MCP requires an API key");
        const response = await this.fetchImpl(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
                "MCP-Protocol-Version": PXXL_MCP_PROTOCOL_VERSION,
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: `pxxl-sdk-${Date.now()}`,
                method,
                ...(params ? { params } : {}),
            }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.error || payload.result === undefined) {
            throw new PxxlAPIError(payload.error?.message || `Pxxl MCP request failed with ${response.status}`, response.status, payload.error || payload);
        }
        return payload.result;
    }
}
export const PxxlCDN = PxxlClient;
export const PxxlCDNError = PxxlAPIError;
/**
 * Unified platform client. Flat PxxlClient methods remain available for
 * compatibility, while grouped resources keep larger integrations readable.
 */
export class Pxxl extends PxxlClient {
    identity;
    api;
    assets;
    cdn;
    storage;
    analytics;
    projects;
    env;
    environments;
    deployments;
    domains;
    customers;
    invoices;
    billing;
    cronjobs;
    cron;
    teams;
    databases;
    mcp;
    constructor(options = {}) {
        super(options);
        this.identity = new PxxlIdentity(this);
        this.api = new PxxlRawAPI(this);
        this.assets = new PxxlAssets(this);
        this.cdn = this.assets;
        this.storage = new PxxlStorage(this);
        this.analytics = new PxxlAnalytics(this);
        this.projects = new PxxlProjects(this);
        this.env = new PxxlEnvironmentVariables(this);
        this.environments = this.env;
        this.deployments = new PxxlDeployments(this);
        this.domains = new PxxlDomains(this);
        this.customers = new PxxlCustomers(this);
        this.invoices = new PxxlInvoices(this);
        this.billing = new PxxlBilling(this);
        this.cronjobs = new PxxlCronJobs(this);
        this.cron = this.cronjobs;
        this.teams = new PxxlTeams(this);
        this.databases = new PxxlDatabases(this);
        this.mcp = new PxxlMCP({
            apiKey: options.mcpApiKey || options.apiKey,
            endpoint: options.mcpEndpoint,
            fetchImpl: options.fetchImpl,
        });
    }
}
export { PxxlAnalytics, PxxlAssets, PxxlBilling, PxxlCronJobs, PxxlCustomers, PxxlDatabases, PxxlDeployments, PxxlDomains, PxxlEnvironmentVariables, PxxlIdentity, PxxlInvoices, PxxlMCP, PxxlRawAPI, PxxlProjects, PxxlStorage, PxxlTeams, };
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
export async function createProjectZip(cwd) {
    const root = resolve(cwd);
    const matcher = ignore().add(defaultPxxlIgnore);
    try {
        matcher.add((await readFile(join(root, ".pxxlignore"), "utf8")).split(/\r?\n/));
    }
    catch {
        // no local ignore file
    }
    const files = {};
    const limits = { count: 0, bytes: 0 };
    await collectFiles(root, root, matcher, files, limits);
    if (Object.keys(files).length === 0)
        throw new Error("No deployable files found after applying .pxxlignore");
    return zipSync(files, { level: 6, mtime: new Date(Date.UTC(1980, 0, 1)) });
}
async function collectFiles(root, dir, matcher, files, limits) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = join(dir, entry.name);
        const rel = relative(root, full).replace(/\\/g, "/");
        if (!rel || matcher.ignores(rel) || matcher.ignores(`${rel}/`))
            continue;
        if (entry.isSymbolicLink())
            continue;
        if (entry.isDirectory()) {
            await collectFiles(root, full, matcher, files, limits);
            continue;
        }
        if (!entry.isFile())
            continue;
        if (looksSensitive(rel))
            throw new Error(`Refusing to package sensitive file: ${rel}`);
        const bytes = await readFile(full);
        limits.count += 1;
        limits.bytes += bytes.byteLength;
        if (limits.count > MAX_DEPLOY_FILES)
            throw new Error(`Refusing to package more than ${MAX_DEPLOY_FILES} files. Add entries to .pxxlignore.`);
        if (limits.bytes > MAX_DEPLOY_SOURCE_BYTES)
            throw new Error(`Refusing to package more than ${Math.round(MAX_DEPLOY_SOURCE_BYTES / 1024 / 1024)} MiB of source files. Add entries to .pxxlignore.`);
        files[rel] = new Uint8Array(bytes);
    }
}
function looksSensitive(path) {
    const lower = path.toLowerCase();
    return lower.endsWith(".pem") || lower.endsWith(".key") || lower.includes("id_rsa") || lower.includes("service-account") || lower.includes("credentials.json");
}
export async function readPxxlToml(cwd) {
    try {
        return parseToml(await readFile(join(cwd, "pxxl.toml"), "utf8"));
    }
    catch {
        return {};
    }
}
export async function writeDefaultPxxlFiles(cwd, config) {
    await writeFile(join(cwd, "pxxl.toml"), stringifyToml(config));
    await writeFile(join(cwd, ".pxxlignore"), `${defaultPxxlIgnore.join("\n")}\n`);
}
export async function copyBoilerplate(name, destination, repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..")) {
    const src = join(repoRoot, "boilerplates", name);
    if (!(await exists(src)))
        throw new Error(`Unknown boilerplate: ${name}`);
    await copyDirectory(src, destination);
}
export async function readBoilerplateManifest(name, repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..")) {
    try {
        const data = await readFile(join(repoRoot, "boilerplates", name, "pxxl.boilerplate.json"), "utf8");
        return JSON.parse(data);
    }
    catch {
        return undefined;
    }
}
async function copyDirectory(src, dest) {
    await mkdir(dest, { recursive: true });
    for (const entry of await readdir(src, { withFileTypes: true })) {
        const from = join(src, entry.name);
        const to = join(dest, entry.name);
        if (entry.isDirectory())
            await copyDirectory(from, to);
        else if (entry.isFile())
            await copyFile(from, to);
    }
}
async function exists(path) {
    try {
        await access(path);
        return true;
    }
    catch {
        return false;
    }
}
export async function saveAuthConfig(apiKey, _baseUrl) {
    const existing = await readStoredAuthConfig();
    const path = configPath();
    await mkdir(dirname(path), { recursive: true });
    const { baseUrl: _ignored, ...rest } = existing;
    await writeFile(path, JSON.stringify({ ...rest, apiKey }, null, 2), { mode: 0o600 });
    await chmod(path, 0o600).catch(() => undefined);
}
export async function saveTeamSelection(teamId) {
    const existing = await readStoredAuthConfig();
    const next = { ...existing, selectedTeamId: teamId || undefined };
    const { baseUrl: _ignored, ...stored } = next;
    if (!stored.apiKey && !stored.selectedTeamId)
        return clearAuthConfig();
    const path = configPath();
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(stored, null, 2), { mode: 0o600 });
    await chmod(path, 0o600).catch(() => undefined);
}
export async function readAuthConfig() {
    const stored = await readStoredAuthConfig();
    return {
        apiKey: process.env.PXXL_API_KEY || stored.apiKey,
        selectedTeamId: process.env.PXXL_TEAM_ID || stored.selectedTeamId,
    };
}
async function readStoredAuthConfig() {
    try {
        return JSON.parse(await readFile(configPath(), "utf8"));
    }
    catch {
        return {};
    }
}
export async function clearAuthConfig() {
    await rm(configPath(), { force: true });
}
export function configPath() {
    return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "pxxl", "config.json");
}
export function sha256Hex(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}
function requiredConfig(value, key) {
    if (!value || !String(value).trim())
        throw new Error(`Missing ${key}. Add it to pxxl.toml or pass a CLI flag.`);
    return String(value).trim();
}
function querySuffix(input) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
        if (value !== undefined && value !== null && value !== "")
            params.set(key, String(value));
    }
    return params.size ? `?${params.toString()}` : "";
}
function teamQuery(teamId) {
    return teamId && teamId.trim() ? `?teamId=${encodeURIComponent(teamId.trim())}` : "";
}
function queryString(values) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
        if (value !== undefined && value !== null && value !== "")
            params.set(key, String(value));
    }
    return params.size ? `?${params.toString()}` : "";
}
