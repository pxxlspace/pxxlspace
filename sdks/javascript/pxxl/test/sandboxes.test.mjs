import assert from "node:assert/strict";
import test from "node:test";
import { Pxxl, Sandbox, SandboxError } from "../../../../dist/index.js";

const base = "https://server.pxxl.app/api/v3";
const sandbox = (fields = {}) => ({ id: "sbx_1", name: "demo", template: "node", status: "creating", domain: "demo.pxxl.click", cpus: 2, memoryMb: 4096, hourlyUsd: 0.048, autoStopMinutes: 60, ...fields });

function fake(handler) {
  const calls = [];
  const pxxl = new Pxxl({
    apiKey: "pxxl_sbx",
    teamId: "team_1",
    fetchImpl: async (url, init = {}) => {
      const call = { url, method: init.method || "GET", accept: init.headers.get("Accept"), auth: init.headers.get("Authorization"), body: init.body ? JSON.parse(init.body) : undefined };
      calls.push(call);
      return handler(call);
    },
  });
  return { pxxl, calls };
}

function ndjson(lines) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      // Split mid-line to prove the reader buffers partial lines.
      const text = lines.map((line) => JSON.stringify(line)).join("\n") + "\n";
      const cut = Math.floor(text.length / 2);
      controller.enqueue(encoder.encode(text.slice(0, cut)));
      controller.enqueue(encoder.encode(text.slice(cut)));
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson" } });
}

test("create sends the options and returns a Sandbox handle", async () => {
  const { pxxl, calls } = fake(() => Response.json({ sandbox: sandbox() }, { status: 202 }));
  const created = await pxxl.sandboxes.create({ name: "demo", template: "node", size: "small", diskGb: 5, autoStopMinutes: 30, env: { A: "1" } });
  assert.ok(created instanceof Sandbox);
  assert.equal(created.id, "sbx_1");
  assert.equal(created.previewUrl, "https://demo.pxxl.click");
  assert.equal(calls[0].url, `${base}/sandboxes?teamId=team_1`);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].auth, "Bearer pxxl_sbx");
  assert.deepEqual(calls[0].body, { name: "demo", template: "node", size: "small", diskGb: 5, autoStopMinutes: 30, env: { A: "1" } });
});

test("list, get, pricing and lifecycle routes", async () => {
  const { pxxl, calls } = fake(({ url, method }) => {
    if (url.includes("/sandboxes/pricing")) return Response.json({ vcpuHourUsd: 0.012, gbHourUsd: 0.006, sizes: [] });
    if (url.startsWith(`${base}/sandboxes?`) && method === "GET") return Response.json({ sandboxes: [sandbox({ status: "running" })], usage: { monthToDateUsd: 1.5, runningCount: 1, hourlyBurnUsd: 0.048 } });
    if (url.includes("/usage")) return Response.json({ hourlyUsd: 0.048, billedUsd: 0.1, unbilledUsd: 0.01, ledger: [] });
    if (method === "PATCH") return Response.json({ sandbox: sandbox({ status: "running", autoStopMinutes: 15 }) });
    if (url.includes("/stop")) return Response.json({ sandbox: sandbox({ status: "paused" }) });
    if (url.includes("/start")) return Response.json({ message: "starting" });
    if (method === "DELETE") return Response.json({ message: "deleted" });
    return Response.json({ sandbox: sandbox({ status: "running" }) });
  });
  const pricing = await pxxl.sandboxes.pricing();
  assert.equal(pricing.vcpuHourUsd, 0.012);
  const { sandboxes, usage } = await pxxl.sandboxes.list();
  assert.equal(sandboxes[0].status, "running");
  assert.equal(usage.runningCount, 1);
  const one = await pxxl.sandboxes.get("sbx_1");
  await one.setAutoStop(15);
  assert.equal(one.info.autoStopMinutes, 15);
  await one.stop();
  assert.equal(one.isPaused, true);
  await one.resume(); // no sandbox in the response: refreshes
  assert.equal(one.status, "running");
  assert.equal((await one.usage()).billedUsd, 0.1);
  await one.delete();
  assert.deepEqual(calls.map((call) => `${call.method} ${call.url.replace(base, "")}`), [
    "GET /sandboxes/pricing",
    "GET /sandboxes?teamId=team_1",
    "GET /sandboxes/sbx_1?teamId=team_1",
    "PATCH /sandboxes/sbx_1?teamId=team_1",
    "POST /sandboxes/sbx_1/stop?teamId=team_1",
    "POST /sandboxes/sbx_1/start?teamId=team_1",
    "GET /sandboxes/sbx_1?teamId=team_1",
    "GET /sandboxes/sbx_1/usage?teamId=team_1",
    "DELETE /sandboxes/sbx_1?teamId=team_1",
  ]);
  assert.deepEqual(calls[3].body, { autoStopMinutes: 15 });
});

test("exec without onOutput returns the JSON result", async () => {
  const { pxxl, calls } = fake(({ url }) => (url.includes("/exec") ? Response.json({ exitCode: 0, output: "v22\n", timedOut: false, truncated: false, durationMs: 12 }) : Response.json({ sandbox: sandbox({ status: "running" }) })));
  const box = await pxxl.sandboxes.get("sbx_1");
  const result = await box.exec("node -v", { workdir: "/workspace/app", timeoutSeconds: 30 });
  assert.equal(result.output, "v22\n");
  assert.equal(calls[1].accept, null);
  assert.deepEqual(calls[1].body, { command: "node -v", workdir: "/workspace/app", timeoutSeconds: 30 });
});

test("exec with onOutput streams NDJSON and resolves with the exit", async () => {
  const { pxxl, calls } = fake(({ url }) => (url.includes("/exec")
    ? ndjson([{ type: "output", data: "one\n" }, { type: "output", data: "two\n" }, { type: "exit", exitCode: 3, timedOut: false, durationMs: 40 }])
    : Response.json({ sandbox: sandbox({ status: "running" }) })));
  const box = await pxxl.sandboxes.get("sbx_1");
  const chunks = [];
  const result = await box.exec("false", { onOutput: (chunk) => chunks.push(chunk) });
  assert.equal(calls[1].accept, "application/x-ndjson");
  assert.deepEqual(chunks, ["one\n", "two\n"]);
  assert.equal(result.exitCode, 3);
  assert.equal(result.output, "one\ntwo\n");
  assert.equal(result.durationMs, 40);
});

test("exec with onOutput falls back to plain JSON and surfaces stream errors", async () => {
  let mode = "json";
  const { pxxl } = fake(({ url }) => {
    if (!url.includes("/exec")) return Response.json({ sandbox: sandbox({ status: "running" }) });
    return mode === "json" ? Response.json({ exitCode: 0, output: "all at once", timedOut: false }) : ndjson([{ type: "output", data: "x" }, { type: "error", message: "runtime gone" }]);
  });
  const box = await pxxl.sandboxes.get("sbx_1");
  const chunks = [];
  const result = await box.exec("echo", { onOutput: (chunk) => chunks.push(chunk) });
  assert.deepEqual(chunks, ["all at once"]);
  assert.equal(result.exitCode, 0);
  mode = "error";
  await assert.rejects(box.exec("echo", { onOutput: () => {} }), /runtime gone/);
});

test("files read, write and list", async () => {
  const { pxxl, calls } = fake(({ url, method }) => {
    if (url.includes("/files")) return Response.json({ files: [{ path: "/workspace/a.js", name: "a.js", type: "file", size: 3, depth: 1 }] });
    if (url.includes("/file?") && method === "GET") return Response.json({ path: "/workspace/a.js", content: "hi\n" });
    if (url.includes("/file")) return Response.json({ path: "/workspace/a.js", saved: true });
    return Response.json({ sandbox: sandbox({ status: "running" }) });
  });
  const box = await pxxl.sandboxes.get("sbx_1");
  assert.equal(await box.files.read("/workspace/a.js"), "hi\n");
  await box.files.write("/workspace/a.js", "hello");
  const files = await box.files.list("/workspace");
  assert.equal(files[0].name, "a.js");
  assert.equal(calls[1].url, `${base}/sandboxes/sbx_1/file?path=%2Fworkspace%2Fa.js&teamId=team_1`);
  assert.equal(calls[2].method, "PUT");
  assert.deepEqual(calls[2].body, { path: "/workspace/a.js", content: "hello" });
  assert.equal(calls[3].url, `${base}/sandboxes/sbx_1/files?path=%2Fworkspace&teamId=team_1`);
});

test("waitUntilReady polls until running and throws on failed", async () => {
  const statuses = ["creating", "creating", "running"];
  const { pxxl } = fake(({ method }) => (method === "POST" ? Response.json({ sandbox: sandbox() }, { status: 202 }) : Response.json({ sandbox: sandbox({ status: statuses.shift() || "running" }) })));
  const box = await pxxl.sandboxes.create();
  await box.waitUntilReady({ intervalMs: 1 });
  assert.equal(box.status, "running");

  const failing = fake(({ method }) => (method === "POST" ? Response.json({ sandbox: sandbox() }, { status: 202 }) : Response.json({ sandbox: sandbox({ status: "failed" }) })));
  const bad = await failing.pxxl.sandboxes.create();
  await assert.rejects(bad.waitUntilReady({ intervalMs: 1 }), (error) => error instanceof SandboxError && error.sandbox.status === "failed");
});
