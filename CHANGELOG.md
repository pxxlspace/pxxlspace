# Changelog

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
