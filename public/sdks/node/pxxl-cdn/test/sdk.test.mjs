import assert from "node:assert/strict";
import test from "node:test";
import { PxxlCDN, PxxlCDNError } from "../dist/index.js";

test("sends bearer auth and parses summary", async () => {
  const client = new PxxlCDN({
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

test("uploads multipart file without forcing json content type", async () => {
  const client = new PxxlCDN({
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

test("throws typed errors", async () => {
  const client = new PxxlCDN({
    apiKey: "pxxl_test",
    fetchImpl: async () => Response.json({ message: "nope" }, { status: 403 }),
  });
  await assert.rejects(() => client.listAssets(), (error) => {
    assert.ok(error instanceof PxxlCDNError);
    assert.equal(error.status, 403);
    return true;
  });
});

test("downloads asset blobs", async () => {
  const client = new PxxlCDN({
    apiKey: "pxxl_test",
    fetchImpl: async (url) => {
      assert.equal(url, "https://gateway.pxxl.app/api/v3/cdn/assets/asset_1/download");
      return new Response("hello");
    },
  });
  const blob = await client.downloadAsset("asset_1");
  assert.equal(await blob.text(), "hello");
});

test("deletes assets", async () => {
  const client = new PxxlCDN({
    apiKey: "pxxl_test",
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://gateway.pxxl.app/api/v3/cdn/assets/asset_1");
      assert.equal(init.method, "DELETE");
      return Response.json({ success: true });
    },
  });
  await client.deleteAsset("asset_1");
});
