import assert from "node:assert/strict";
import test from "node:test";
import { Pxxl, Sandbox, SandboxError, SandboxSnapshotError } from "../../../../dist/index.js";

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

test("labels on create, list filters and setLabels", async () => {
  const { pxxl, calls } = fake(({ url, method }) => {
    if (method === "GET" && url.startsWith(`${base}/sandboxes?`)) return Response.json({ sandboxes: [sandbox({ labels: { team: "payments" } })], usage: {} });
    if (method === "PATCH") return Response.json({ sandbox: sandbox({ labels: { team: "growth" } }) });
    return Response.json({ sandbox: sandbox({ labels: { team: "payments", env: "ci" } }) }, { status: 202 });
  });
  const created = await pxxl.sandboxes.create({ template: "python", labels: { team: "payments", env: "ci" } });
  assert.deepEqual(calls[0].body, { template: "python", labels: { team: "payments", env: "ci" } });
  assert.deepEqual(created.labels, { team: "payments", env: "ci" });
  const { sandboxes } = await pxxl.sandboxes.list({ labels: { team: "payments", env: true } });
  assert.equal(sandboxes[0].labels.team, "payments");
  assert.equal(calls[1].url, `${base}/sandboxes?label=team%3Apayments&label=env&teamId=team_1`);
  await created.setLabels({ team: "growth" });
  assert.equal(calls[2].method, "PATCH");
  assert.deepEqual(calls[2].body, { labels: { team: "growth" } });
  assert.deepEqual(created.labels, { team: "growth" });
});

test("processes and kill", async () => {
  const { pxxl, calls } = fake(({ url, method }) => {
    if (url.includes("/processes/")) return Response.json({ pid: 42, signal: "KILL" });
    if (url.includes("/processes")) return Response.json({ processes: [{ pid: 42, ppid: 1, elapsedSeconds: 9, cpuPercent: 0.5, memoryKb: 2048, command: "python3 -m http.server 3000" }] });
    return Response.json({ sandbox: sandbox({ status: "running" }) });
  });
  const box = await pxxl.sandboxes.get("sbx_1");
  const processes = await box.processes();
  assert.equal(processes[0].pid, 42);
  assert.equal(processes[0].command, "python3 -m http.server 3000");
  assert.deepEqual(await box.kill(42, "KILL"), { pid: 42, signal: "KILL" });
  await box.kill(42);
  assert.equal(calls[1].url, `${base}/sandboxes/sbx_1/processes?teamId=team_1`);
  assert.equal(calls[2].method, "DELETE");
  assert.equal(calls[2].url, `${base}/sandboxes/sbx_1/processes/42?signal=KILL&teamId=team_1`);
  assert.equal(calls[3].url, `${base}/sandboxes/sbx_1/processes/42?signal=TERM&teamId=team_1`);
});

test("binary files: read with { binary: true } and write bytes as base64", async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xfe]);
  const encoded = Buffer.from(png).toString("base64");
  const { pxxl, calls } = fake(({ url, method }) => {
    if (url.includes("/file?") && method === "GET") return Response.json({ path: "/workspace/a.png", encoding: "base64", content: encoded });
    if (url.includes("/file")) return Response.json({ path: "/workspace/a.png", saved: true });
    return Response.json({ sandbox: sandbox({ status: "running" }) });
  });
  const box = await pxxl.sandboxes.get("sbx_1");
  const read = await box.files.read("/workspace/a.png", { binary: true });
  assert.ok(read instanceof Uint8Array);
  assert.deepEqual([...read], [...png]);
  assert.equal(calls[1].url, `${base}/sandboxes/sbx_1/file?path=%2Fworkspace%2Fa.png&encoding=base64&teamId=team_1`);
  await box.files.write("/workspace/a.png", png);
  assert.deepEqual(calls[2].body, { path: "/workspace/a.png", content: encoded, encoding: "base64" });
  await box.files.write("/workspace/b.png", Buffer.from(png));
  assert.deepEqual(calls[3].body, { path: "/workspace/b.png", content: encoded, encoding: "base64" });
});

test("templates come from pricing with their versions", async () => {
  const { pxxl } = fake(() => Response.json({ templates: [{ id: "base", label: "Base", description: "Debian 13" }, { id: "node", label: "Node.js", version: "26.13.1" }] }));
  const templates = await pxxl.sandboxes.templates();
  assert.equal(templates[1].version, "26.13.1");
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

test("CLI: sandbox exec streams output and exits with the command's code", async () => {
  const { createServer } = await import("node:http");
  const { execFile } = await import("node:child_process");
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    requests.push({ method: req.method, url: req.url, accept: req.headers.accept, body });
    if (req.url.endsWith("/exec")) {
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      res.write(`${JSON.stringify({ type: "output", data: "built\n" })}\n`);
      return res.end(`${JSON.stringify({ type: "exit", exitCode: 3, timedOut: false })}\n`);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ sandbox: sandbox({ status: "running" }) }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const cli = new URL("../../../../dist/cli.js", import.meta.url).pathname;
  const run = (args) => new Promise((resolve) => execFile(process.execPath, [cli, ...args], { env: { ...process.env, PXXL_API_URL: `http://127.0.0.1:${port}`, PXXL_API_KEY: "pxxl_test", NO_COLOR: "1" } }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr })));
  try {
    const result = await run(["sandbox", "exec", "sbx_1", "--", "npm", "run", "build", "--help"]);
    assert.equal(result.stdout, "built\n");
    assert.equal(result.code, 3);
    const exec = requests.find((request) => request.url.endsWith("/exec"));
    assert.equal(exec.accept, "application/x-ndjson");
    assert.deepEqual(JSON.parse(exec.body), { command: "npm run build --help" });
    const help = await run(["sandbox", "--help"]);
    assert.match(help.stdout, /pxxl sandbox exec/);
  } finally {
    server.close();
  }
});

test("CLI: sandbox upload, download, ps, kill and list --label", async () => {
  const { createServer } = await import("node:http");
  const { execFile } = await import("node:child_process");
  const { mkdtemp, readFile, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const stored = new Map();
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const path = req.url.replace(/^\/api\/v3/, "");
    requests.push({ method: req.method, url: path, body });
    const url = new URL(path, "http://x");
    res.writeHead(url.pathname.endsWith("/processes/99") ? 404 : 200, { "Content-Type": "application/json" });
    if (url.pathname.endsWith("/file") && req.method === "PUT") {
      const input = JSON.parse(body);
      stored.set(input.path, input);
      return res.end(JSON.stringify({ path: input.path }));
    }
    if (url.pathname.endsWith("/file")) return res.end(JSON.stringify({ path: url.searchParams.get("path"), encoding: "base64", content: stored.get(url.searchParams.get("path")).content }));
    if (url.pathname.endsWith("/processes")) return res.end(JSON.stringify({ processes: [{ pid: 7, ppid: 1, elapsedSeconds: 75, cpuPercent: 1.25, memoryKb: 10240, command: "python3 -m http.server" }] }));
    if (url.pathname.endsWith("/processes/7")) return res.end(JSON.stringify({ pid: 7, signal: url.searchParams.get("signal") }));
    if (url.pathname.endsWith("/processes/99")) return res.end(JSON.stringify({ error: "no such process" }));
    if (url.pathname === "/sandboxes") return res.end(JSON.stringify({ sandboxes: [sandbox({ status: "running", labels: { team: "payments" } })], usage: { runningCount: 1 } }));
    res.end(JSON.stringify({ sandbox: sandbox({ status: "running" }) }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const dir = await mkdtemp(join(tmpdir(), "pxxl-sbx-"));
  const cli = new URL("../../../../dist/cli.js", import.meta.url).pathname;
  const run = (args) => new Promise((resolve) => execFile(process.execPath, [cli, ...args], { cwd: dir, env: { ...process.env, PXXL_API_URL: `http://127.0.0.1:${port}`, PXXL_API_KEY: "pxxl_test", NO_COLOR: "1" } }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr })));
  try {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 0xff, 0xfe, 0x80]);
    await writeFile(join(dir, "logo.png"), bytes);
    assert.equal((await run(["sandbox", "upload", "sbx_1", "logo.png"])).code, 0);
    assert.deepEqual(stored.get("/workspace/logo.png"), { path: "/workspace/logo.png", content: bytes.toString("base64"), encoding: "base64" });
    assert.equal((await run(["sandbox", "download", "sbx_1", "/workspace/logo.png", "copy.png"])).code, 0);
    assert.deepEqual(await readFile(join(dir, "copy.png")), bytes);
    assert.equal((await run(["sandbox", "write", "sbx_1", "/workspace/w.png", "--file", "logo.png"])).code, 0);
    assert.equal(stored.get("/workspace/w.png").encoding, "base64");
    const ps = await run(["sandbox", "ps", "sbx_1"]);
    assert.match(ps.stdout, /python3 -m http.server/);
    assert.match(ps.stdout, /1m15s/);
    const kill = await run(["sandbox", "kill", "sbx_1", "7", "--signal", "kill"]);
    assert.equal(kill.code, 0);
    assert.ok(requests.some((request) => request.method === "DELETE" && request.url.startsWith("/sandboxes/sbx_1/processes/7?signal=KILL")));
    const missing = await run(["sandbox", "kill", "sbx_1", "99"]);
    assert.notEqual(missing.code, 0);
    assert.match(missing.stderr + missing.stdout, /No process 99/);
    const list = await run(["sandbox", "list", "--label", "team=payments"]);
    assert.match(list.stdout, /team=payments/);
    assert.ok(requests.some((request) => request.url === "/sandboxes?label=team%3Apayments"));
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("egress on create, setNetwork and update({ egress })", async () => {
  const { pxxl, calls } = fake(({ method, body }) => {
    if (method === "PATCH" && body.egress?.mode === "deny-all") return Response.json({ sandbox: sandbox({ egress: { mode: "deny-all", allow: [] } }), egressApplied: false, message: "Applies at the next start." });
    if (method === "PATCH") return Response.json({ sandbox: sandbox({ egress: { mode: body.egress.mode || "allowlist", allow: body.egress.allow || [] } }), egressApplied: true });
    return Response.json({ sandbox: sandbox({ egress: { mode: "allowlist", allow: ["github.com", "*.npmjs.org"] } }) }, { status: 202 });
  });
  const box = await pxxl.sandboxes.create({ template: "node", egress: { allow: ["github.com", "*.npmjs.org"] } });
  assert.deepEqual(calls[0].body, { template: "node", egress: { allow: ["github.com", "*.npmjs.org"] } });
  assert.deepEqual(box.egress, { mode: "allowlist", allow: ["github.com", "*.npmjs.org"] });

  const blocked = await box.setNetwork({ mode: "deny-all" });
  assert.equal(calls[1].method, "PATCH");
  assert.equal(calls[1].url, `${base}/sandboxes/sbx_1?teamId=team_1`);
  assert.deepEqual(calls[1].body, { egress: { mode: "deny-all" } });
  assert.equal(blocked.egressApplied, false);
  assert.equal(blocked.message, "Applies at the next start.");
  assert.equal(box.egress.mode, "deny-all");

  const opened = await pxxl.sandboxes.setNetwork("sbx_1", { mode: "allow-all" });
  assert.deepEqual(calls[2].body, { egress: { mode: "allow-all" } });
  assert.equal(opened.egressApplied, true);
  assert.equal(opened.message, undefined);

  await box.update({ egress: { mode: "allowlist", allow: ["1.2.3.0/24"] } });
  assert.deepEqual(calls[3].body, { egress: { mode: "allowlist", allow: ["1.2.3.0/24"] } });
  assert.deepEqual(box.egress, { mode: "allowlist", allow: ["1.2.3.0/24"] });

  const plain = new Sandbox(pxxl.sandboxes, sandbox());
  assert.deepEqual(plain.egress, { mode: "allow-all", allow: [] });
});

test("CLI: create --allow/--no-internet and sandbox network", async () => {
  const { createServer } = await import("node:http");
  const { execFile } = await import("node:child_process");
  const requests = [];
  let pending = false;
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const path = req.url.replace(/^\/api\/v3/, "");
    requests.push({ method: req.method, url: path, body: body ? JSON.parse(body) : undefined });
    res.writeHead(200, { "Content-Type": "application/json" });
    if (req.method === "POST") return res.end(JSON.stringify({ sandbox: sandbox({ egress: JSON.parse(body).egress }) }));
    if (req.method === "PATCH") {
      const egress = JSON.parse(body).egress;
      return res.end(JSON.stringify({ sandbox: sandbox({ status: "running", egress }), egressApplied: !pending, ...(pending ? { message: "This sandbox predates network policies; the policy applies at its next start." } : {}) }));
    }
    res.end(JSON.stringify({ sandbox: sandbox({ status: "running", egress: { mode: "allowlist", allow: ["github.com", "*.npmjs.org"] } }) }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const cli = new URL("../../../../dist/cli.js", import.meta.url).pathname;
  const run = (args) => new Promise((resolve) => execFile(process.execPath, [cli, ...args], { env: { ...process.env, PXXL_API_URL: `http://127.0.0.1:${port}`, PXXL_API_KEY: "pxxl_test", NO_COLOR: "1" } }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr })));
  const last = () => requests[requests.length - 1];
  try {
    assert.equal((await run(["sandbox", "create", "--template", "node", "--allow", "github.com", "--allow=*.npmjs.org"])).code, 0);
    assert.deepEqual(last().body.egress, { mode: "allowlist", allow: ["github.com", "*.npmjs.org"] });
    assert.equal((await run(["sandbox", "create", "--no-internet"])).code, 0);
    assert.deepEqual(last().body.egress, { mode: "deny-all", allow: [] });
    assert.equal((await run(["sandbox", "create"])).code, 0);
    assert.equal(last().body.egress, undefined);
    const both = await run(["sandbox", "create", "--no-internet", "--allow", "github.com"]);
    assert.notEqual(both.code, 0);

    const shown = await run(["sandbox", "network", "sbx_1"]);
    assert.equal(shown.code, 0);
    assert.match(shown.stdout, /only github\.com, \*\.npmjs\.org \(allowlist\)/);
    assert.equal(last().method, "GET");

    const denied = await run(["sandbox", "network", "sbx_1", "--deny-all"]);
    assert.equal(denied.code, 0);
    assert.deepEqual(last(), { method: "PATCH", url: "/sandboxes/sbx_1", body: { egress: { mode: "deny-all", allow: [] } } });
    assert.match(denied.stdout, /no internet/);
    await run(["sandbox", "network", "sbx_1", "--allow-all"]);
    assert.deepEqual(last().body, { egress: { mode: "allow-all", allow: [] } });
    pending = true;
    const listed = await run(["sandbox", "network", "sbx_1", "--allow", "pypi.org", "--allow", "140.82.112.0/20"]);
    assert.deepEqual(last().body, { egress: { mode: "allowlist", allow: ["pypi.org", "140.82.112.0/20"] } });
    assert.match(listed.stdout, /applies at its next start/);
    const conflict = await run(["sandbox", "network", "sbx_1", "--allow-all", "--no-internet"]);
    assert.notEqual(conflict.code, 0);
    const help = await run(["sandbox", "--help"]);
    assert.match(help.stdout, /pxxl sandbox network/);
  } finally {
    server.close();
  }
});

const snap = (fields = {}) => ({ id: "snap_1", name: "deps", template: "node", version: "26.13.1", status: "creating", error: null, sizeBytes: 52428800, sizeMb: 50, sourceSandboxId: "sbx_1", cpus: 2, memoryMb: 4096, volumeLimitMb: 5120, createdAt: new Date().toISOString(), ...fields });

test("snapshots: list, get, delete and create({ snapshotId }) routes", async () => {
  const { pxxl, calls } = fake(({ url, method }) => {
    if (method === "POST") return Response.json({ sandbox: sandbox({ template: "node" }) }, { status: 202 });
    if (method === "DELETE") return Response.json({ message: "deleted" });
    if (url.includes("/snapshots/snap_1")) return Response.json({ snapshot: snap({ status: "ready" }) });
    return Response.json({ snapshots: [snap({ status: "ready" })] });
  });
  const all = await pxxl.sandboxes.snapshots.list();
  assert.equal(all[0].id, "snap_1");
  await pxxl.sandboxes.snapshots.list({ sandboxId: "sbx_1" });
  assert.equal((await pxxl.sandboxes.snapshots.get("snap_1")).status, "ready");
  await pxxl.sandboxes.snapshots.delete("snap_1");
  await pxxl.sandboxes.create({ snapshotId: "snap_1" });
  assert.deepEqual(calls.map((call) => `${call.method} ${call.url.replace(base, "")}`), [
    "GET /sandboxes/snapshots?teamId=team_1",
    "GET /sandboxes/snapshots?sandboxId=sbx_1&teamId=team_1",
    "GET /sandboxes/snapshots/snap_1?teamId=team_1",
    "DELETE /sandboxes/snapshots/snap_1?teamId=team_1",
    "POST /sandboxes?teamId=team_1",
  ]);
  assert.deepEqual(calls[4].body, { snapshotId: "snap_1" });
});

test("sandbox.snapshot() polls until ready, wait: false returns at once, failed throws", async () => {
  const statuses = ["creating", "creating", "ready"];
  const { pxxl, calls } = fake(({ url, method }) => {
    if (method === "POST") return Response.json({ snapshot: snap() }, { status: 202 });
    if (url.includes("/snapshots/")) return Response.json({ snapshot: snap({ status: statuses.shift() || "ready" }) });
    return Response.json({ sandbox: sandbox({ status: "running" }) });
  });
  const box = await pxxl.sandboxes.get("sbx_1");
  const ready = await box.snapshot({ name: "deps", intervalMs: 1 });
  assert.equal(ready.status, "ready");
  assert.equal(calls[1].url, `${base}/sandboxes/sbx_1/snapshots?teamId=team_1`);
  assert.deepEqual(calls[1].body, { name: "deps" });
  assert.equal(calls.filter((call) => call.url.includes("/snapshots/snap_1")).length, 3);

  const before = calls.length;
  const pending = await box.snapshot({ wait: false });
  assert.equal(pending.status, "creating");
  assert.deepEqual(calls[before].body, {});
  assert.equal(calls.length, before + 1);

  const failing = fake(({ url, method }) => {
    if (method === "POST") return Response.json({ snapshot: snap() }, { status: 202 });
    if (url.includes("/snapshots/")) return Response.json({ snapshot: snap({ status: "failed", error: "disk full" }) });
    return Response.json({ sandbox: sandbox({ status: "running" }) });
  });
  const bad = await failing.pxxl.sandboxes.get("sbx_1");
  await assert.rejects(bad.snapshot({ intervalMs: 1 }), (error) => error instanceof SandboxSnapshotError && error.snapshot.status === "failed" && /disk full/.test(error.message));
});

test("CLI: sandbox snapshot, snapshots, snapshot-rm and create --snapshot", async () => {
  const { createServer } = await import("node:http");
  const { execFile } = await import("node:child_process");
  const requests = [];
  let polls = 0;
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const path = req.url.replace(/^\/api\/v3/, "");
    requests.push({ method: req.method, url: path, body: body ? JSON.parse(body) : undefined });
    const url = new URL(path, "http://x");
    const send = (status, value) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
    if (req.method === "POST" && url.pathname === "/sandboxes/sbx_1/snapshots") return send(202, { snapshot: snap({ name: JSON.parse(body).name || "auto" }) });
    if (req.method === "DELETE" && url.pathname === "/sandboxes/snapshots/snap_busy") return send(409, { message: "This snapshot is still used by 2 sandboxes.", sandboxIds: ["sbx_a", "sbx_b"] });
    if (req.method === "DELETE") return send(200, { message: "deleted" });
    if (url.pathname === "/sandboxes/snapshots/snap_1") { polls += 1; return send(200, { snapshot: snap({ status: polls > 1 ? "ready" : "creating" }) }); }
    if (url.pathname === "/sandboxes/snapshots") return send(200, { snapshots: [snap({ status: "ready" }), snap({ id: "snap_2", name: "fresh", status: "creating", sizeBytes: undefined, sizeMb: undefined })] });
    if (req.method === "POST" && url.pathname === "/sandboxes") return send(202, { sandbox: sandbox() });
    send(200, { sandbox: sandbox({ status: "running" }) });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const cli = new URL("../../../../dist/cli.js", import.meta.url).pathname;
  const run = (args) => new Promise((resolve) => execFile(process.execPath, [cli, ...args], { env: { ...process.env, PXXL_API_URL: `http://127.0.0.1:${port}`, PXXL_API_KEY: "pxxl_test", NO_COLOR: "1" } }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr })));
  const last = () => requests[requests.length - 1];
  try {
    const taken = await run(["sandbox", "snapshot", "sbx_1", "--name", "deps"]);
    assert.equal(taken.code, 0, taken.stderr);
    assert.match(taken.stdout, /Snapshot deps snap_1 is ready \(50 MB\)/);
    assert.match(taken.stdout, /pxxl sandbox create --snapshot snap_1/);
    assert.ok(requests.some((request) => request.method === "POST" && request.url === "/sandboxes/sbx_1/snapshots" && request.body.name === "deps"));
    assert.ok(polls >= 2);

    polls = 0;
    const quick = await run(["sandbox", "snapshot", "sbx_1", "--no-wait"]);
    assert.equal(quick.code, 0, quick.stderr);
    assert.match(quick.stdout, /is creating/);
    assert.equal(polls, 0);

    const listed = await run(["sandbox", "snapshots", "--sandbox", "sbx_1"]);
    assert.equal(listed.code, 0, listed.stderr);
    assert.match(listed.stdout, /ID\s+NAME\s+STATUS\s+SIZE\s+CREATED/);
    assert.match(listed.stdout, /snap_1\s+deps\s+ready\s+50 MB/);
    assert.match(listed.stdout, /snap_2\s+fresh\s+creating/);
    assert.equal(last().url, "/sandboxes/snapshots?sandboxId=sbx_1");
    const asJSON = await run(["sandbox", "snapshots", "ls", "--json"]);
    assert.equal(JSON.parse(asJSON.stdout).snapshots.length, 2);
    assert.equal(last().url, "/sandboxes/snapshots");

    const removed = await run(["sandbox", "snapshot-rm", "snap_1", "--yes"]);
    assert.equal(removed.code, 0, removed.stderr);
    assert.deepEqual(last(), { method: "DELETE", url: "/sandboxes/snapshots/snap_1", body: undefined });
    const busy = await run(["sandbox", "snapshots", "rm", "snap_busy", "--yes"]);
    assert.notEqual(busy.code, 0);
    assert.match(busy.stderr + busy.stdout, /still used by 2 sandboxes/);
    assert.match(busy.stderr + busy.stdout, /sbx_a, sbx_b/);
    const unconfirmed = await run(["sandbox", "snapshot-rm", "snap_1"]);
    assert.notEqual(unconfirmed.code, 0);
    assert.match(unconfirmed.stderr + unconfirmed.stdout, /--yes/);

    assert.equal((await run(["sandbox", "create", "--snapshot", "snap_1"])).code, 0);
    assert.deepEqual(last().body, { snapshotId: "snap_1" });
    const help = await run(["sandbox", "--help"]);
    assert.match(help.stdout, /pxxl sandbox snapshot/);
  } finally {
    server.close();
  }
});
