import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { unzipSync } from "fflate";
import {
  PxxlAPIError,
  PxxlClient,
  createProjectZip,
  readBoilerplateManifest,
  readPxxlToml,
  saveAuthConfig,
  saveTeamSelection,
  readAuthConfig,
  clearAuthConfig,
} from "../dist/index.js";

test("sends bearer auth and parses CDN summary", async () => {
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://server.pxxl.app/api/v3/cdn/summary");
      assert.equal(init.headers.get("Authorization"), "Bearer pxxl_test");
      return Response.json({ data: { totalFiles: 1, recentAssets: [] } });
    },
  });
  const summary = await client.summary();
  assert.equal(summary.totalFiles, 1);
});

test("reads boilerplate manifest deploy defaults", async () => {
  const manifest = await readBoilerplateManifest("express-bun", process.cwd());
  assert.equal(manifest.packageManager, "bun");
  assert.equal(manifest.framework, "express");
  assert.equal(manifest.startCommand, "bun src/server.js");
});

test("reads turbo monorepo boilerplate services", async () => {
  const manifest = await readBoilerplateManifest("turbo-monorepo", process.cwd());
  assert.equal(manifest.family, "monorepo");
  assert.equal(manifest.packageManager, "pnpm");
  assert.equal(manifest.services.length, 2);
  assert.equal(manifest.services[0].baseDirectory, "apps/web");
  assert.equal(manifest.services[0].buildCommand, "cd ../.. && pnpm --filter @pxxl/turbo-web run build");
  assert.equal(manifest.services[1].framework, "express");
});

test("uploads CDN multipart file without forcing json content type", async () => {
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://server.pxxl.app/api/v3/cdn/assets");
      assert.equal(init.method, "POST");
      assert.equal(init.headers.get("Content-Type"), null);
      assert.ok(init.body instanceof FormData);
      assert.equal(init.body.get("visibility"), "private");
      return Response.json({ asset: { id: "asset_1", fileName: "logo.png", size: 4, visibility: "private", kind: "file" } }, { status: 201 });
    },
  });
  const asset = await client.uploadAsset({ file: new Blob(["test"]), fileName: "logo.png", visibility: "private" });
  assert.equal(asset.id, "asset_1");
});

test("whoami uses the API-key compatible CLI identity route", async () => {
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://server.pxxl.app/api/v3/cli/whoami");
      assert.equal(init.headers.get("Authorization"), "Bearer pxxl_test");
      return Response.json({ success: true, user: { id: "user_1", email: "user@example.test" }, authMethod: "api_key" });
    },
  });
  const result = await client.whoami();
  assert.equal(result.user.email, "user@example.test");
});

test("stats and usage use CLI-safe API-key routes with team context", async () => {
  const calls = [];
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    teamId: "team_123",
    fetchImpl: async (url, init) => {
      calls.push({ url, auth: init.headers.get("Authorization") });
      return Response.json({ success: true, data: { summary: { totalProjects: 2 } } });
    },
  });
  await client.stats();
  await client.platformUsage();
  assert.deepEqual(calls, [
    { url: "https://server.pxxl.app/api/v3/cli/stats?teamId=team_123", auth: "Bearer pxxl_test" },
    { url: "https://server.pxxl.app/api/v3/cli/usage?teamId=team_123", auth: "Bearer pxxl_test" },
  ]);
});

test("searches domains and preserves promo pricing fields", async () => {
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://server.pxxl.app/api/v3/domains/search");
      assert.equal(init.method, "POST");
      assert.deepEqual(JSON.parse(init.body), { query: "pxxl.cv" });
      return Response.json({
        query: "pxxl.cv",
        count: 1,
        results: [{ domain: "pxxl.cv", available: true, tld: ".cv", bonusAmount: 2000, bonusAmountUSD: 1.3 }],
      });
    },
  });
  const result = await client.searchDomains({ query: "pxxl.cv" });
  assert.equal(result.results[0].bonusAmount, 2000);
});

test("lists domains and fetches CLI domain stats with team context", async () => {
  const calls = [];
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    teamId: "team_123",
    fetchImpl: async (url, init) => {
      calls.push({ url, auth: init.headers.get("Authorization") });
      if (url.includes("/stats")) return Response.json({ success: true, domain: "example.com", data: { analytics: { pageViews: 10 } } });
      return Response.json({ success: true, domains: ["example.com"], total: 1 });
    },
  });
  const domains = await client.listDomains();
  const stats = await client.domainStats("example.com", { timeframe: "30d" });
  assert.equal(domains.domains[0], "example.com");
  assert.equal(stats.domain, "example.com");
  assert.deepEqual(calls.map((call) => call.url), [
    "https://server.pxxl.app/api/v3/cli/domains?teamId=team_123",
    "https://server.pxxl.app/api/v3/cli/domains/example.com/stats?timeframe=30d&teamId=team_123",
  ]);
});

test("checks domains through the CLI-safe domain route", async () => {
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    teamId: "team_123",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://server.pxxl.app/api/v3/cli/domains/example.com/check?teamId=team_123");
      assert.equal(init.headers.get("Authorization"), "Bearer pxxl_test");
      return Response.json({ success: true, domain: "example.com", status: "available" });
    },
  });
  const result = await client.checkDomain("example.com");
  assert.equal(result.status, "available");
});

test("connects domains and keeps plan-limit rejects separate", async () => {
  const calls = [];
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    teamId: "team_123",
    fetchImpl: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      if (init.body.includes("overflow.com")) {
        return Response.json({ code: "DOMAIN_LIMIT_EXCEEDED", message: "Your current plan allows up to 1 custom domains.", limit: 1, used: 1 }, { status: 403 });
      }
      return Response.json({ error: false, domainId: "dom_1", domain: { name: "example.com" }, expectedARecordIp: "193.181.212.65" });
    },
  });
  const result = await client.connectDomains([
    { domain: "example.com", projectId: "proj_1" },
    { domain: "overflow.com", projectId: "proj_1" },
  ]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].status, 403);
  assert.deepEqual(calls.map((call) => call.url), [
    "https://server.pxxl.app/api/v3/cli/domains?teamId=team_123",
    "https://server.pxxl.app/api/v3/cli/domains?teamId=team_123",
  ]);
});

test("manages domain DNS records through CLI-safe routes", async () => {
  const calls = [];
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });
      return Response.json({ error: false, records: [{ type: "A", name: "@", value: "193.181.212.65" }] });
    },
  });
  await client.listDomainDNSRecords("dom_1");
  await client.createDomainDNSRecord("dom_1", { type: "A", name: "@", value: "193.181.212.65", ttl: 60 });
  await client.updateDomainDNSRecords("dom_1", { recordId: "rec_1", type: "A", name: "@", value: "193.181.212.66" });
  await client.deleteDomainDNSRecord("dom_1", { recordId: "rec_1" });
  assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
    "GET https://server.pxxl.app/api/v3/cli/domains/dom_1/dns-records",
    "POST https://server.pxxl.app/api/v3/cli/domains/dom_1/dns-records",
    "PUT https://server.pxxl.app/api/v3/cli/domains/dom_1/dns-records",
    "DELETE https://server.pxxl.app/api/v3/cli/domains/dom_1/dns-records",
  ]);
});

test("resyncs and disconnects domains through CLI-safe routes", async () => {
  const calls = [];
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    teamId: "team_123",
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method || "GET" });
      return Response.json({ success: true });
    },
  });
  await client.resyncDomainProxy("example.com");
  await client.disconnectDomain("example.com", { projectId: "proj_123" });
  assert.deepEqual(calls, [
    { method: "POST", url: "https://server.pxxl.app/api/v3/cli/domains/example.com/resync?teamId=team_123" },
    { method: "DELETE", url: "https://server.pxxl.app/api/v3/cli/domains/example.com?projectId=proj_123&teamId=team_123" },
  ]);
});

test("uses generic activation status for non-cv domain connection checks", async () => {
  const calls = [];
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    teamId: "team_123",
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method || "GET" });
      if (url.endsWith("/cli/domains/dom_1?teamId=team_123")) {
        return Response.json({ id: "dom_1", name: "example.com" });
      }
      return Response.json({ status: "active", routeStatus: "connected" });
    },
  });
  const result = await client.getDomainZoneStatus("dom_1");
  assert.equal(result.status, "active");
  assert.deepEqual(calls, [
    { method: "GET", url: "https://server.pxxl.app/api/v3/cli/domains/dom_1?teamId=team_123" },
    { method: "POST", url: "https://server.pxxl.app/api/v3/cli/domains/dom_1/activate?teamId=team_123" },
  ]);
});

test("uses cv zone status for cv domain connection checks", async () => {
  const calls = [];
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method || "GET" });
      if (url.endsWith("/cli/domains/dom_cv")) {
        return Response.json({ id: "dom_cv", domain: { name: "pxxl.cv" } });
      }
      return Response.json({ status: "active", zoneStatus: "connected" });
    },
  });
  const result = await client.getDomainConnectionStatus("dom_cv");
  assert.equal(result.zoneStatus, "connected");
  assert.deepEqual(calls, [
    { method: "GET", url: "https://server.pxxl.app/api/v3/cli/domains/dom_cv" },
    { method: "GET", url: "https://server.pxxl.app/api/v3/cli/domains/dom_cv/zone-status" },
  ]);
});

test("manages cron jobs through CLI-safe routes", async () => {
  const calls = [];
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    teamId: "team_123",
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });
      if (url.endsWith("/runs?page=1&limit=20&teamId=team_123")) {
        return Response.json({ runs: [{ id: "run_1", cronJobId: "cron_1", status: "success", startedAt: "2026-06-26T00:00:00Z" }] });
      }
      if (url.endsWith("/validate-schedule")) return Response.json({ valid: true, nextRun: "2026-06-26T00:05:00Z" });
      if (url.endsWith("/validate-url")) return Response.json({ reachable: true, statusCode: 200 });
      if ((init.method || "GET") === "GET") return Response.json({ cronJobs: [{ id: "cron_1", name: "cleanup", schedule: "*/5 * * * *", url: "https://example.com/job", method: "GET", status: "active" }] });
      return Response.json({ id: "cron_1", name: "cleanup", schedule: "*/5 * * * *", url: "https://example.com/job", method: "GET", status: "active" });
    },
  });
  await client.listCronJobs();
  await client.createCronJob({ name: "cleanup", schedule: "*/5 * * * *", url: "https://example.com/job" });
  await client.updateCronJob("cron_1", { status: "paused" });
  await client.triggerCronJob("cron_1");
  await client.listCronJobRuns("cron_1", { page: 1, limit: 20 });
  await client.validateCronSchedule("*/5 * * * *");
  await client.validateCronURL("https://example.com/job");
  assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
    "GET https://server.pxxl.app/api/v3/cli/cronjobs?teamId=team_123",
    "POST https://server.pxxl.app/api/v3/cli/cronjobs?teamId=team_123",
    "PUT https://server.pxxl.app/api/v3/cli/cronjobs/cron_1?teamId=team_123",
    "POST https://server.pxxl.app/api/v3/cli/cronjobs/cron_1/trigger?teamId=team_123",
    "GET https://server.pxxl.app/api/v3/cli/cronjobs/cron_1/runs?page=1&limit=20&teamId=team_123",
    "POST https://server.pxxl.app/api/v3/cli/cronjobs/validate-schedule",
    "POST https://server.pxxl.app/api/v3/cli/cronjobs/validate-url",
  ]);
});

test("cron plan limits remain typed API errors", async () => {
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    fetchImpl: async () => Response.json({ code: "CRON_JOB_LIMIT_REACHED", message: "Cron job limit reached (1/1).", limit: 1, current: 1 }, { status: 403 }),
  });
  await assert.rejects(() => client.createCronJob({ name: "cleanup", schedule: "*/5 * * * *", url: "https://example.com/job" }), (error) => {
    assert.ok(error instanceof PxxlAPIError);
    assert.equal(error.status, 403);
    assert.equal(error.details.code, "CRON_JOB_LIMIT_REACHED");
    return true;
  });
});

test("diffs env vars without requesting remote secret values", async () => {
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://server.pxxl.app/api/v3/cli/projects/proj_1/envs/diff");
      assert.equal(init.method, "POST");
      assert.deepEqual(JSON.parse(init.body), { vars: [{ key: "API_KEY", value: "local", isSecret: true }] });
      return Response.json({ success: true, projectId: "proj_1", scope: "app", counts: { changed: 1 }, diff: [{ key: "API_KEY", status: "changed", local: true, remote: true, same: false }] });
    },
  });
  const result = await client.diffProjectEnv("proj_1", [{ key: "API_KEY", value: "local", isSecret: true }]);
  assert.equal(result.diff[0].status, "changed");
});

test("fetches project and deployment logs through CLI-safe routes", async () => {
  const calls = [];
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    fetchImpl: async (url) => {
      calls.push(url);
      return Response.json({ success: true, logs: [] });
    },
  });
  await client.projectLogs("proj_1", { lines: 50, live: true, since: "1h" });
  await client.deploymentLogs("dep_1", { build: true, since: "1h" });
  assert.deepEqual(calls, [
    "https://server.pxxl.app/api/v3/cli/projects/proj_1/live-logs?tail=50&since=1h",
    "https://server.pxxl.app/api/v3/cli/deployments/dep_1/build-logs?since=1h",
  ]);
});

test("network failures explain connectivity", async () => {
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
  });
  await assert.rejects(() => client.whoami(), /Could not reach Pxxl Gateway.*Check your internet connection/);
});

test("lists TLD prices", async () => {
  const client = new PxxlClient({
    fetchImpl: async (url) => {
      assert.equal(url, "https://server.pxxl.app/api/v3/domains/tlds");
      return Response.json({ count: 1, tlds: [{ tld: ".cv", registerDollar: 4.99, registerNaira: 7600 }] });
    },
  });
  const result = await client.listTLDs();
  assert.equal(result.tlds[0].tld, ".cv");
});

test("throws typed errors", async () => {
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    fetchImpl: async () => Response.json({ message: "nope" }, { status: 403 }),
  });
  await assert.rejects(() => client.listAssets(), (error) => {
    assert.ok(error instanceof PxxlAPIError);
    assert.equal(error.status, 403);
    return true;
  });
});

test("packages deploy zip with .pxxlignore", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pxxl-test-"));
  try {
    await writeFile(join(dir, "index.html"), "<h1>Hello</h1>");
    await writeFile(join(dir, ".env"), "SECRET=1");
    await writeFile(join(dir, ".pxxlignore"), "ignored.txt\n");
    await writeFile(join(dir, "ignored.txt"), "nope");
    await mkdir(join(dir, "node_modules"));
    await writeFile(join(dir, "node_modules", "x.js"), "nope");
    const archive = await createProjectZip(dir);
    const files = unzipSync(archive);
    assert.ok(files["index.html"]);
    assert.equal(files[".env"], undefined);
    assert.equal(files[".pxxlignore"], undefined);
    assert.equal(files["ignored.txt"], undefined);
    assert.equal(files["node_modules/x.js"], undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("reads pxxl.toml", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pxxl-test-"));
  try {
    await writeFile(join(dir, "pxxl.toml"), 'name = "my-app"\ndomainChoice = "pxxl.pro"\nport = 3000\n');
    const config = await readPxxlToml(dir);
    assert.equal(config.name, "my-app");
    assert.equal(config.port, 3000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("auth config honors PXXL_API_KEY override", async () => {
  await withTempConfig(async () => {
    await saveAuthConfig("stored_key");
    const original = process.env.PXXL_API_KEY;
    process.env.PXXL_API_KEY = "env_key";
    try {
      const config = await readAuthConfig();
      assert.equal(config.apiKey, "env_key");
    } finally {
      if (original === undefined) delete process.env.PXXL_API_KEY;
      else process.env.PXXL_API_KEY = original;
      await clearAuthConfig();
    }
  });
});

test("database requests include selected team context", async () => {
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    teamId: "team_123",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://server.pxxl.app/api/v3/databases?teamId=team_123");
      assert.equal(init.method, "POST");
      assert.deepEqual(JSON.parse(init.body), {
        name: "app-db",
        type: "postgres",
        dailyBackupsEnabled: false,
      });
      return Response.json({ success: true, database: { id: "db_1", name: "app-db", type: "postgres", status: "creating" } });
    },
  });
  const result = await client.createDatabase({ name: "app-db", type: "postgres" });
  assert.equal(result.database.id, "db_1");
});

test("team selection persists without dropping credentials", async () => {
  await withTempConfig(async () => {
    await saveAuthConfig("stored_key", "https://stored.test/api/v3");
    await saveTeamSelection("team_123");
    const config = await readAuthConfig();
    assert.equal(config.apiKey, "stored_key");
    assert.equal("baseUrl" in config, false);
    assert.equal(config.selectedTeamId, "team_123");
    await saveTeamSelection(undefined);
    const cleared = await readAuthConfig();
    assert.equal(cleared.selectedTeamId, undefined);
    assert.equal(cleared.apiKey, "stored_key");
    await clearAuthConfig();
  });
});

test("project automation uses CLI-safe API routes", async () => {
  const calls = [];
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, method: init.method || "GET", body: init.body ? JSON.parse(init.body) : undefined });
      if (url.endsWith("/cli/projects/proj_1")) {
        return Response.json({ project: { id: "proj_1", name: "web", githubUrl: "https://github.com/pxxlspace/web", githubBranch: "main" } });
      }
      return Response.json({ success: true });
    },
  });
  await client.getProject("proj_1");
  await client.redeployProject("proj_1", { commitSha: "abcdef1", commitMessage: "manual" });
  await client.pushProjectEnv("proj_1", [{ key: "API_URL", value: "https://api.example.test", isSecret: true }]);

  assert.deepEqual(calls.map((call) => [call.method, call.url]), [
    ["GET", "https://server.pxxl.app/api/v3/cli/projects/proj_1"],
    ["POST", "https://server.pxxl.app/api/v3/cli/projects/proj_1/redeploy"],
    ["POST", "https://server.pxxl.app/api/v3/cli/projects/proj_1/envs/bulk"],
  ]);
  assert.deepEqual(calls[2].body, { vars: [{ key: "API_URL", value: "https://api.example.test", isSecret: true }], replace: false });
});

test("deploy marks archives as CLI deploy source", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pxxl-test-"));
  try {
    await writeFile(join(dir, "package.json"), JSON.stringify({ scripts: { start: "node server.js" } }));
    await writeFile(join(dir, "server.js"), "console.log('ok')");
    await writeFile(join(dir, "pxxl.toml"), 'name = "cli-app"\ndomainChoice = "pxxl.pro"\nprojectId = "proj_existing"\nport = 3000\n');
    const client = new PxxlClient({
      apiKey: "pxxl_test",
      fetchImpl: async (url, init) => {
        assert.equal(url, "https://server.pxxl.app/api/v3/projects/spacedrop");
        const form = init.body;
        assert.equal(form.get("deploymentSource"), "clideploy");
        assert.equal(form.get("sourceShape"), "clideploy");
        assert.equal(form.get("projectId"), "proj_existing");
        assert.equal(form.get("commitMessage"), "ship local changes");
        assert.equal(form.get("name"), "cli-app");
        return Response.json({ success: true, projectId: "proj_1", deploymentId: "dep_1" }, { status: 201 });
      },
    });
    const result = await client.deploy({ cwd: dir, commitMessage: "ship local changes" });
    assert.equal(result.projectId, "proj_1");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("domain invoice SDK methods stay out of CLI routes", async () => {
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    teamId: "team_123",
    fetchImpl: async (url) => {
      assert.equal(url, "https://server.pxxl.app/api/v3/cli/domainprovider/invoices?teamId=team_123");
      return Response.json({ error: false, invoices: [{ id: "inv_1", status: "pending", grandTotal: 10 }] });
    },
  });
  const result = await client.listDomainInvoices();
  assert.equal(result.invoices[0].id, "inv_1");
});

async function withTempConfig(fn) {
  const original = process.env.XDG_CONFIG_HOME;
  const dir = await mkdtemp(join(tmpdir(), "pxxl-config-test-"));
  process.env.XDG_CONFIG_HOME = dir;
  try {
    await fn();
  } finally {
    if (original === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = original;
    await rm(dir, { recursive: true, force: true });
  }
}
