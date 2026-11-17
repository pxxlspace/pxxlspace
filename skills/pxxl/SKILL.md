---
name: pxxl
description: Deploy and run apps on Pxxl with the pxxl CLI. Use when the user wants to deploy, host or ship a project on Pxxl, read Pxxl build or runtime logs, fix a failed Pxxl deploy, set env vars or secrets, add a Pxxl database, connect a domain, roll back, or check whether a Pxxl app is up.
---

# Pxxl

Pxxl hosts web apps, APIs, static sites, Dockerfiles and Docker images, plus managed databases,
storage buckets, HTTP cron jobs and custom domains. Drive it with the `pxxl` CLI.
Full setup steps: https://pxxl.app/prompt.md. Command reference: https://pxxl.app/agents.md.

## Rules

- Never print, commit or paste API keys, MCP keys or database passwords. If one appears in output, don't repeat it.
- Set secrets with `pxxl env add KEY` (pipe the value in). Don't commit `.env` files; `pxxl env pull` writes `.env.local` for local runs only.
- Ask the person before anything destructive: `pxxl rm`, `pxxl db delete`, `pxxl domains disconnect`, `pxxl env push --force`, `pxxl rollback`.
- One folder, one project. If `pxxl.toml` has a `projectId`, use that project; don't create a second one.
- Pass `--json` when you need to read results; it prints the raw API response.

## Before you start

```bash
pxxl whoami
```

If it fails, the person needs an API key from https://pxxl.app/dashboard/settings (Developer > API keys),
then `pxxl login --api-key <key>`. Ask them for it; don't guess.

## Deploy

```bash
pxxl inspect          # detected framework, commands, port, env files
pxxl doctor           # auth, config and deploy problems
pxxl deploy           # first time: add --name <name> --domain pxxl.pro --yes
```

`pxxl deploy` streams the build and prints the live URL. Web servers must listen on `PORT` and
bind to `0.0.0.0`. Static sites need no server: Pxxl publishes the build output folder.

Build settings live in `pxxl.toml` (`buildCommand`, `startCommand`, `port`, `framework`) or
`pxxl project update --start-command "..." --port 8080`.

## When something fails

```bash
pxxl errors              # what failed in the latest build, grouped
pxxl logs --build -f     # follow a build
pxxl logs -f             # runtime logs
pxxl health              # status, URL and health check
pxxl metrics --range 1h  # CPU, memory, requests
pxxl curl /api/health    # request the live app
```

Common causes: the app listens on a fixed port or `localhost` instead of `PORT` on `0.0.0.0`;
a missing env var; a start command that exits; dev dependencies needed at build time.

Fix the code or settings, then `pxxl deploy` again. `pxxl rollback` puts an earlier deployment
back live (ask first).

## Env vars

```bash
pxxl env ls
printf '%s' "$VALUE" | pxxl env add KEY
pxxl env rm KEY
```

Changes apply on the next deploy.

## Databases

```bash
pxxl db create --name main-db --type postgres   # also mysql, mariadb, mongodb, redis, keydb, dragonfly, clickhouse
pxxl db list
pxxl db get <database-id>                       # credentials and connection URLs
```

Give the app its URL through an env var (for example `DATABASE_URL`), never in code.

## Domains

```bash
pxxl domains connect example.com    # prints the DNS records to add
pxxl domains check example.com      # DNS, ownership, SSL and route
```

HTTPS is issued once DNS points at Pxxl.

## Done

Report the live URL and what you set up (project, databases, env var names, domains), never secret values.
