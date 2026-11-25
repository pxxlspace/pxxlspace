# Changelog

## Unreleased

- Sandboxes (Plus and up): isolated Linux workspaces billed per second from your wallet
  ($0.012 per vCPU-hour, $0.006 per GB-hour, 10 GB disk included, $0 while paused).
- SDK: `pxxl.sandboxes.create/list/get/pricing` returns a `Sandbox` with `exec` (streams output
  with `onOutput`), `files.read/write/list`, `previewUrl`, `start`/`stop`, `delete`,
  `waitUntilReady`, `usage`, `logs` and `setAutoStop`. Python: `client.sandboxes`, same shape.
- CLI: `pxxl sandbox` with `create [--wait]`, `list`, `get`, `exec <id> -- <command>` (exits with
  the command's exit code), `files`, `read`, `write`, `start`, `stop`, `delete`, `update`, `usage`,
  `logs`, `terminal` and `pricing`.
- Sandbox templates: `base` (Debian 13, the default), `node`, `python`, `go`, `rust` and `bun`;
  `pricing().templates` carry each runtime's version. `pxxl.sandboxes.templates()` and
  `pxxl sandbox templates`.
- Sandbox labels: `create({ labels })`, `list({ labels })` filters, `sandbox.setLabels()`; CLI
  `--label key=value` on `create`, `list` and `update`. Python: `labels=`, `set_labels()`.
- Sandbox network policies: `create({ egress: { mode?, allow? } })`, `sandbox.egress`,
  `sandbox.setNetwork({ mode?, allow? })` and `pxxl.sandboxes.setNetwork(id, policy)` returning
  `{ sandbox, egressApplied, message? }` (types `SandboxEgress`, `EgressPolicy`). Python:
  `egress=`, `sandbox.egress`, `set_network(mode, allow)`. CLI: `create --allow <domain|cidr>`
  (repeat) and `--no-internet`; `pxxl sandbox network <id>` shows or changes the policy with
  `--allow-all`, `--deny-all`/`--no-internet` or `--allow`.
- Sandbox snapshots (Plus 5, Pro 25, Enterprise 100): `sandbox.snapshot({ name?, wait? })` saves
  the home directory and `/workspace` and waits until ready (throws `SandboxSnapshotError` on
  failure); `pxxl.sandboxes.snapshots.list({ sandboxId? })`, `.get(id)`, `.delete(id)`,
  `.create(sandboxId, …)` and `.waitUntilReady()`; `create({ snapshotId })` starts from one (type
  `SandboxSnapshot`). Python: `sandbox.snapshot(name=None, wait=True)`,
  `client.sandboxes.snapshots.list/get/delete`, `create(snapshot_id=...)`. CLI:
  `pxxl sandbox snapshot <id> [--name] [--no-wait]`, `pxxl sandbox snapshots [--sandbox <id>]`,
  `snapshots get|rm <snapshotId>` (alias `snapshot-rm`; a 409 shows which sandboxes use it) and
  `create --snapshot <snapshotId>`.
- Sandbox fast starts: default-size Node, Python and base sandboxes start in about 2 seconds.
- Sandbox processes: `sandbox.processes()` and `sandbox.kill(pid, signal)`; CLI `ps` and `kill`.
- Binary sandbox files: `files.read(path, { binary: true })` returns bytes and `files.write()` takes
  a `Uint8Array`/`Buffer` (Python: `binary=True`, `bytes`); CLI `upload` and `download`, and
  `write --file` is binary-safe.
- The Python SDK and the CLI honour `PXXL_API_URL` (https://*.pxxl.app or localhost), like the
  JavaScript SDK, for testing against a staging Gateway.

## 0.6.0 - 2026-11-17

- `pxxl setup agent`: installs the CLI globally and adds the Pxxl skill to Claude Code, Codex,
  Cursor and OpenCode. With `--mcp-key` it also registers Pxxl's MCP server in each of them,
  after checking the key. `--api-key` signs the CLI in. Safe to run again.
- `skills/pxxl`: one skill for deploying and running apps on Pxxl (deploy, failures, env,
  databases, domains), with rules against leaking keys and deleting without asking.

## 0.5.0 - 2026-11-13

Go, Python and Rust SDKs: 0.3.0.

- Domain reselling (Pro and Enterprise): sell domains to your own customers, paid from your Pxxl
  wallet at wholesale. Use a reseller key (`pxxl_rsl_…`) from Tools > Domain reseller.
- CLI: `pxxl domains reseller` with `account`, `prices`, `check`, `quote`, `buy`, `transfer`, `list`,
  `status`, `renew`, `lock`/`unlock`, `transfer-code`, `charges`, `dns` and `nameservers`.
- SDK: `pxxl.reseller.*` (JS), `client.Reseller()` (Go), `client.reseller` (Python), `client.reseller()` (Rust).
- Deleting a `.cv` DNS record takes the record id and its zone id (`zoneId`, `--zone-id`).

## 0.4.0 - 2026-11-12

- `pxxl deploy` streams the build and ends with the live URL; picks a Pxxl domain on the first deploy.
- New: `pxxl link`/`unlink`, `pxxl dev [--tunnel]` (your dev server with the project's env vars),
  `pxxl ls`, `pxxl rollback`, `pxxl rebuild`, `pxxl cancel`, `pxxl errors`, `pxxl health`,
  `pxxl metrics`, `pxxl curl`, `pxxl restart|pause|resume`, `pxxl cache purge`, `pxxl rm`,
  `pxxl project update|auto-deploy|history|usage`, `pxxl env add|rm|get|pull`.
- `pxxl logs -f` prints each line once; `pxxl logs --build -f` and `pxxl watch` follow builds live.
- `pxxl servers`: link your own servers and manage them (health, metrics, apps, events, alerts,
  restart/start/stop/logs per app, prune, update, operations, settings, rename, unlink).
  SDK: `pxxl.servers.*`.
- Pickers show the 20 newest items and accept a typed name.
- SDK: `pxxl.projects.status/metrics/update/restart/pause/resume/delete/purgeCache`,
  `pxxl.deployments.rollback/cancel/rebuild/buildErrors`, `pxxl.env.add/update/remove/reveal`.
- Clearer output for projects, domains, invoices, billing, analytics and doctor; API errors include the server's detail.

## 0.3.1 - 2026-11-12

- Same as 0.3.0, which npm staged but never published.

## 0.3.0 - 2026-11-12

- Add tunnels: `pxxl tunnel 3000` shares a local app at a public HTTPS URL, with
  WebSockets, optional basic auth, request/response headers and Host rewriting.
  The SDK's `pxxl.tunnels.expose()` / `connect()` run the same client in Node.
- Add webhooks: create endpoints, list and inspect requests, replay them, and
  `pxxl webhook listen --forward http://localhost:3000/...` to stream them to
  your machine (`pxxl.webhooks.listen()` in the SDK).
- Add `pxxl check http|domain` and `pxxl tools` for plan limits.
- `PXXL_API_URL` can point the CLI and SDK at a Pxxl staging Gateway
  (https://*.pxxl.app) or localhost for testing.

## 0.2.0 - 2026-09-30

- Expand the Node.js, Go, Python, and Rust clients across projects, deployments,
  environment variables, domains, billing, CDN, Storage, databases, cron jobs,
  analytics, teams, and MCP.
- Add source archive deployment helpers with secret-aware file exclusions.
- Add platform automation and CLI commands for the expanded API surface.
- Add SDK examples and unified documentation for authentication, errors,
  responses, and publishing.

## 0.1.0 - 2026-06-27

- Publish the initial Pxxl SDK clients.
