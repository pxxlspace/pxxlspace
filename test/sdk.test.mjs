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
      assert.equal(url, "https://gateway.pxxl.app/api/v3/cdn/summary");
      assert.equal(init.headers.get("Authorization"), "Bearer pxxl_test");
      return Response.json({ data: { totalFiles: 1, recentAssets: [] } });
    },
  });
  const summary = await client.summary();
  assert.equal(summary.totalFiles, 1);
});

test("reads boilerplate manifest deploy defaults", async () => {
  const manifest = await readBoilerplateManifest("express-bun-pxxl", process.cwd());
  assert.equal(manifest.packageManager, "bun");
  assert.equal(manifest.framework, "express");
  assert.equal(manifest.startCommand, "bun src/server.js");
});

test("uploads CDN multipart file without forcing json content type", async () => {
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://gateway.pxxl.app/api/v3/cdn/assets");
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
      assert.equal(url, "https://gateway.pxxl.app/api/v3/cli/whoami");
      assert.equal(init.headers.get("Authorization"), "Bearer pxxl_test");
      return Response.json({ success: true, user: { id: "user_1", email: "user@example.test" }, authMethod: "api_key" });
    },
  });
  const result = await client.whoami();
  assert.equal(result.user.email, "user@example.test");
});

test("searches domains and preserves promo pricing fields", async () => {
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://gateway.pxxl.app/api/v3/domains/search");
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

test("lists TLD prices", async () => {
  const client = new PxxlClient({
    fetchImpl: async (url) => {
      assert.equal(url, "https://gateway.pxxl.app/api/v3/domains/tlds");
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
      assert.equal(url, "https://gateway.pxxl.app/api/v3/databases?teamId=team_123");
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
    ["GET", "https://gateway.pxxl.app/api/v3/cli/projects/proj_1"],
    ["POST", "https://gateway.pxxl.app/api/v3/cli/projects/proj_1/redeploy"],
    ["POST", "https://gateway.pxxl.app/api/v3/cli/projects/proj_1/envs/bulk"],
  ]);
  assert.deepEqual(calls[2].body, { vars: [{ key: "API_URL", value: "https://api.example.test", isSecret: true }] });
});

test("domain invoice SDK methods stay out of CLI routes", async () => {
  const client = new PxxlClient({
    apiKey: "pxxl_test",
    teamId: "team_123",
    fetchImpl: async (url) => {
      assert.equal(url, "https://gateway.pxxl.app/api/v3/cli/domainprovider/invoices?teamId=team_123");
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
