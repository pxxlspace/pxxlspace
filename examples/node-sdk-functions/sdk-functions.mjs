import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { Pxxl } from "@pxxlapp/pxxl";

const apiKey = process.env.PXXL_API_KEY;
if (!apiKey) {
  console.error("PXXL_API_KEY is required");
  process.exit(1);
}

const pxxl = new Pxxl({
  apiKey,
  teamId: process.env.PXXL_TEAM_ID,
});

export async function deployLocalCodebase(directory = ".") {
  return pxxl.deploy({
    cwd: resolve(directory),
    name: process.env.PXXL_PROJECT_NAME || "sdk-example",
    domainChoice: process.env.PXXL_DOMAIN_CHOICE || "pxxl.app",
    port: 3000,
    framework: "express",
    language: "node",
    packageManager: "npm",
    installCommand: "npm install",
    buildCommand: "npm run build --if-present",
    startCommand: "npm start",
    commitMessage: "Deploy from the Pxxl Node SDK",
  });
}

export async function redeployProject(projectId) {
  return pxxl.redeployProject(projectId, {
    commitMessage: "Redeploy from the Pxxl Node SDK",
  });
}

export async function uploadPublicAsset(filePath) {
  const bytes = await readFile(filePath);
  return pxxl.uploadAsset({
    file: new Blob([bytes]),
    fileName: basename(filePath),
    visibility: "public",
  });
}

export async function listCdnAssets() {
  return pxxl.listAssets({ limit: 20, page: 1 });
}

export async function downloadCdnAsset(assetId) {
  return pxxl.downloadAsset(assetId);
}

export async function deleteCdnAsset(assetId) {
  return pxxl.deleteAsset(assetId);
}

export async function searchDomainsWithPrices(query = "example.cv") {
  const [search, tlds] = await Promise.all([
    pxxl.searchDomains({ query }),
    pxxl.listTLDs(),
  ]);
  return { search, tlds };
}

export async function createDomainCheckout(customerInput, domainName, years = 1) {
  const customer = await pxxl.customers.create(customerInput);
  const purchase = await pxxl.domains.purchase({
    customerId: customer.id,
    domains: [{ domainName, years }],
    currency: "NGN",
  });
  const payment = await pxxl.invoices.getPaymentUrl(purchase.invoice.id);
  return { customer, purchase, payment };
}

export async function createStorageBucket(name = "sdk-assets") {
  return pxxl.storage.createBucket({ name, visibility: "private" });
}

export async function listStorageObjects(bucketId) {
  return pxxl.storage.listObjects(bucketId, { limit: 20, page: 1 });
}

export async function getDomainStats(domain, timeframe = "30d") {
  return pxxl.domainStats(domain, { timeframe });
}

export async function connectDomainToProject(domain, projectId) {
  return pxxl.connectDomain({ domain, projectId });
}

export async function connectDomainsToProject(domains, projectId) {
  return pxxl.connectDomains(domains.map((domain) => ({ domain, projectId })));
}

export async function verifyDomainForProject(domain, projectId) {
  return pxxl.verifyDomainRecord({ domain, projectId });
}

export async function resyncDomainProxy(domain) {
  return pxxl.resyncDomainProxy(domain);
}

export async function disconnectDomainFromProject(domain, projectId) {
  return pxxl.disconnectDomain(domain, { projectId });
}

export async function addDomainARecord(domainId, value = "193.181.212.65") {
  return pxxl.createDomainDNSRecord(domainId, {
    type: "A",
    name: "@",
    value,
    ttl: 60,
  });
}

export async function listManagedDomainRecords(domainId) {
  return pxxl.listDomainDNSRecords(domainId);
}

export async function downloadDomainCertificate(domainId) {
  return pxxl.downloadDomainCertificate(domainId);
}

export async function createCronJob(name = "cache warmer", url = "https://example.com/api/warm-cache") {
  return pxxl.createCronJob({
    name,
    schedule: "*/5 * * * *",
    url,
    method: "POST",
    timeoutSeconds: 10,
    headers: {
      "User-Agent": "Pxxl-Cron/1.0",
    },
  });
}

export async function listCronJobs() {
  return pxxl.listCronJobs();
}

export async function triggerCronJob(cronJobId) {
  return pxxl.triggerCronJob(cronJobId);
}

export async function listCronJobRuns(cronJobId) {
  return pxxl.listCronJobRuns(cronJobId, { page: 1, limit: 20 });
}

export async function validateCronJobInputs(url = "https://example.com/job", schedule = "*/5 * * * *") {
  const [urlResult, scheduleResult] = await Promise.all([
    pxxl.validateCronURL(url),
    pxxl.validateCronSchedule(schedule),
  ]);
  return { url: urlResult, schedule: scheduleResult };
}

export async function listSpaceships() {
  return pxxl.listTeams();
}

export async function listProjects() {
  return pxxl.listProjects({ page: 1, limit: 10 });
}

export async function listDeployments(projectId) {
  return pxxl.listDeployments({ projectId, page: 1, limit: 10 });
}

export async function pushProjectEnv(projectId, vars) {
  return pxxl.pushProjectEnv(projectId, vars.map(([key, value]) => ({
    key,
    value,
    isSecret: true,
  })));
}

export async function createPostgresDatabase(name = "sdk_example_db") {
  return pxxl.createDatabase({
    name,
    type: "postgres",
    dailyBackupsEnabled: true,
  });
}

export async function usageAndStats() {
  const [usage, stats, cdn] = await Promise.all([
    pxxl.platformUsage(),
    pxxl.stats(),
    pxxl.summary(),
  ]);
  return { usage, stats, cdn };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await usageAndStats();
  console.log(JSON.stringify(result, null, 2));
}
