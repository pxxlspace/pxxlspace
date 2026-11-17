import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { agentTargets, mergeCodexMcp, mergeCursorMcp, mergeOpenCodeMcp, selectAgents } from "../../../../dist/cli-setup.js";

const url = "https://mcp.pxxl.app/mcp";

test("codex: replaces only the pxxl table and keeps the rest", () => {
  const before = '# mine\nmodel = "x"\n\n[mcp_servers.pxxl]\nurl = "old"\n\n[mcp_servers.pxxl.env]\nA = "1"\n\n[mcp_servers.other]\nurl = "https://o"\n';
  const after = mergeCodexMcp(before, url, "k1");
  assert.match(after, /# mine\nmodel = "x"/);
  assert.match(after, /\[mcp_servers\.other\]\nurl = "https:\/\/o"/);
  assert.equal(after.match(/\[mcp_servers\.pxxl/g).length, 1);
  assert.doesNotMatch(after, /old|A = "1"/);
  assert.match(after, /http_headers = \{ Authorization = "Bearer k1" \}/);
  assert.equal(mergeCodexMcp(after, url, "k1"), after, "running twice changes nothing");
});

test("codex: new file", () => {
  assert.equal(mergeCodexMcp(undefined, url, "k"), `[mcp_servers.pxxl]\nurl = "${url}"\nhttp_headers = { Authorization = "Bearer k" }\n`);
});

test("cursor and opencode keep other servers", () => {
  const cursor = JSON.parse(mergeCursorMcp(JSON.stringify({ mcpServers: { other: { url: "x" } } }), url, "k"));
  assert.deepEqual(Object.keys(cursor.mcpServers), ["other", "pxxl"]);
  assert.equal(cursor.mcpServers.pxxl.headers.Authorization, "Bearer k");
  const opencode = JSON.parse(mergeOpenCodeMcp(JSON.stringify({ theme: "t", mcp: { other: {} } }), url, "k"));
  assert.equal(opencode.theme, "t");
  assert.equal(opencode.mcp.pxxl.type, "remote");
  assert.ok(opencode.mcp.other);
});

test("selectAgents: installed folders, or the ones asked for", async () => {
  const home = await mkdtemp(join(tmpdir(), "pxxl-setup-"));
  await mkdir(join(home, ".codex"));
  const targets = agentTargets(home);
  const found = await selectAgents(targets, undefined, async () => false);
  assert.deepEqual(found.map((t) => t.id), ["codex"]);
  assert.deepEqual((await selectAgents(targets, "claude,cursor")).map((t) => t.id), ["claude", "cursor"]);
  await assert.rejects(selectAgents(targets, "vim"), /Unknown agent: vim/);
});
