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
    baseUrl: "https://example.test/api/v3/",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://example.test/api/v3/cdn/assets");
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
  await saveAuthConfig("stored_key", "https://stored.test/api/v3");
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
  await saveAuthConfig("stored_key", "https://stored.test/api/v3");
  await saveTeamSelection("team_123");
  const config = await readAuthConfig();
  assert.equal(config.apiKey, "stored_key");
  assert.equal(config.baseUrl, "https://stored.test/api/v3");
  assert.equal(config.selectedTeamId, "team_123");
  await saveTeamSelection(undefined);
  const cleared = await readAuthConfig();
  assert.equal(cleared.selectedTeamId, undefined);
  assert.equal(cleared.apiKey, "stored_key");
  await clearAuthConfig();
});
