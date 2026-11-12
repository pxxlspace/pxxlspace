import assert from "node:assert/strict";
import test from "node:test";
import { Pxxl, resolvePxxlAPIBaseURL } from "../../../../dist/index.js";
import { flag, logLines, projectUrl, words, deploymentStatus, deploymentFrom } from "../../../../dist/cli-platform.js";

function recording() {
  const calls = [];
  const pxxl = new Pxxl({
    apiKey: "pxxl_test",
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url).replace("https://server.pxxl.app/api/v3", ""), method: init.method || "GET", body: init.body ? JSON.parse(String(init.body)) : undefined, auth: new Headers(init.headers).get("authorization") });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  return { pxxl, calls };
}

test("project control uses the CLI's API-key routes", async () => {
  const { pxxl, calls } = recording();
  await pxxl.projects.status("proj_1");
  await pxxl.projects.metrics("proj_1", { range: "1h" });
  await pxxl.projects.update("proj_1", { startCommand: "node server.js", port: 8080 });
  await pxxl.projects.restart("proj_1");
  await pxxl.projects.pause("proj_1");
  await pxxl.projects.resume("proj_1");
  await pxxl.projects.autoDeploy("proj_1", false);
  await pxxl.projects.purgeCache("proj_1", { id: "purge_1" });
  await pxxl.projects.delete("proj_1");
  assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
    "GET /cli/projects/proj_1/live-status",
    "GET /cli/projects/proj_1/metrics?range=1h",
    "PUT /cli/projects/proj_1",
    "POST /cli/projects/proj_1/restart",
    "POST /cli/projects/proj_1/pause",
    "POST /cli/projects/proj_1/restart",
    "PUT /cli/projects/proj_1/auto-deploy",
    "POST /cli/projects/proj_1/cache/purges",
    "DELETE /cli/projects/proj_1",
  ]);
  assert.deepEqual(calls[2].body, { startCommand: "node server.js", port: 8080 });
  assert.deepEqual(calls[6].body, { enabled: false });
  assert.equal(calls[7].body.id, "purge_1");
  assert.ok(calls.every((call) => call.auth === "Bearer pxxl_test"));
});

test("a cache purge gets an id even when none is given", async () => {
  const { pxxl, calls } = recording();
  await pxxl.projects.purgeCache("proj_1");
  assert.match(calls[0].body.id, /^sdk_/);
});

test("deployments: rollback, cancel, rebuild, build errors", async () => {
  const { pxxl, calls } = recording();
  await pxxl.deployments.rollback("dep_1");
  await pxxl.deployments.cancel("dep_1");
  await pxxl.deployments.rebuild("dep_1");
  await pxxl.deployments.buildErrors("dep_1");
  await pxxl.deployments.active();
  assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
    "POST /cli/deployments/dep_1/rollback",
    "POST /cli/deployments/dep_1/cancel",
    "POST /cli/deployments/dep_1/rebuild",
    "GET /cli/deployments/dep_1/build-errors",
    "GET /cli/deployments/active",
  ]);
});

test("environment variables: add, update, remove, reveal", async () => {
  const { pxxl, calls } = recording();
  await pxxl.env.add("proj_1", { key: "API_KEY", value: "x" });
  await pxxl.env.update("proj_1", { key: "API_KEY", value: "y", secret: false });
  await pxxl.env.remove("proj_1", "API_KEY");
  await pxxl.env.reveal("proj_1", "API KEY");
  assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
    "POST /cli/projects/proj_1/envs",
    "PUT /cli/projects/proj_1/envs",
    "DELETE /cli/projects/proj_1/envs",
    "GET /cli/projects/proj_1/envs/reveal?key=API%20KEY",
  ]);
  assert.deepEqual(calls[0].body, { key: "API_KEY", value: "x", isSecret: true });
  assert.deepEqual(calls[2].body, { key: "API_KEY" });
});

test("PXXL_API_URL accepts Pxxl Gateways and localhost only", () => {
  const previous = process.env.PXXL_API_URL;
  try {
    process.env.PXXL_API_URL = "https://staging-gateway.pxxl.app";
    assert.equal(resolvePxxlAPIBaseURL(), "https://staging-gateway.pxxl.app/api/v3");
    process.env.PXXL_API_URL = "http://localhost:8080/api/v3/";
    assert.equal(resolvePxxlAPIBaseURL(), "http://localhost:8080/api/v3");
    process.env.PXXL_API_URL = "https://evil.example.com";
    assert.throws(() => resolvePxxlAPIBaseURL(), /pxxl\.app Gateway or localhost/);
    process.env.PXXL_API_URL = "http://staging-gateway.pxxl.app";
    assert.throws(() => resolvePxxlAPIBaseURL(), /pxxl\.app Gateway or localhost/);
  } finally {
    if (previous === undefined) delete process.env.PXXL_API_URL; else process.env.PXXL_API_URL = previous;
  }
});

test("CLI argument helpers skip flag values and stop at --", () => {
  const args = ["link", "--project", "proj_1", "my-app", "--yes", "--", "npm", "run", "dev"];
  assert.deepEqual(words(args), ["link", "my-app"]);
  assert.equal(flag(args, "--project"), "proj_1");
  assert.equal(flag(["--range=1h"], "--range"), "1h");
  assert.equal(flag(["--port", "--yes"], "--port"), undefined);
});

test("log and deployment shapes are read from every Gateway form", () => {
  const lines = logLines({ logs: [{ timestamp: "2026-11-12T10:00:00Z", content: "built\n" }, "plain line", { message: "" }] });
  assert.deepEqual(lines.map((line) => line.content), ["built", "plain line"]);
  assert.equal(deploymentStatus(deploymentFrom({ id: "dep_1", deploymentStatus: "failed" })), "failed");
  assert.equal(deploymentStatus(deploymentFrom({ deployment: { status: "deployed" } })), "deployed");
  assert.equal(projectUrl({ domains: [{ domain: "app.pxxl.pro" }] }), "https://app.pxxl.pro");
  assert.equal(projectUrl({ url: "https://x.pxxl.pro" }), "https://x.pxxl.pro");
  assert.equal(projectUrl({}), "");
});
