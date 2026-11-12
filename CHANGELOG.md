# Changelog

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
