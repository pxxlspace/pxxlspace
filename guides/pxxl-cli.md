# Pxxl CLI Guide

The root `pxxl` npm package ships one binary:

```bash
npm install -g @pxxlapp/pxxl
pxxl --help
```

## Login

```bash
pxxl login --api-key pxxl_...
```

The CLI validates the key before saving it, then stores credentials at `~/.config/pxxl/config.json` with file mode `0600`.
`PXXL_API_KEY` overrides the stored key.
`PXXL_TEAM_ID` overrides the selected spaceship/team for scoped commands.
The API endpoint is fixed to the official Pxxl Gateway.

## Deploy

```bash
pxxl init --new vite-react-pnpm --name my-app --domain pxxl.pro
pxxl deploy
pxxl redeploy <project-id>
pxxl pull <project-id> ./my-app
pxxl env push <project-id> --file .env
```

`pxxl deploy` reads `pxxl.toml`, applies `.pxxlignore`, creates a temporary ZIP, and sends it to Pxxl.
`pxxl redeploy` triggers a new deployment for an existing project.
`pxxl pull` clones the project repository and branch locally, or updates an existing git checkout with a fast-forward pull.
`pxxl env push` reads a local `.env` file and writes those values to Pxxl project envs.

Use an API key with `scope=all` or `scope=deploy` and `permission=read_write` for deploy and redeploy. Use `scope=project`, `scope=env`, or `scope=all` for environment variable reads and writes.

## Stats and Usage

```bash
pxxl stats
pxxl usage
pxxl stats --team <team-id>
pxxl usage --json
```

`pxxl stats` and `pxxl usage` use CLI-safe API-key routes and print readable summaries by default: project counts, deployment counts, build minutes, artifact storage, top projects, and recent deployments.
Use `--json` when you need the raw response for automation.

## Boilerplates

```bash
pxxl init --new
pxxl init --new express-bun --name my-api
pxxl init --new vite-react-pnpm --name react-app
pxxl init --new turbo-monorepo --name workspace-app
pxxl init --new php-basic --name php-app
```

Interactive init lists clean framework names such as Express, Vite React, Turbo Monorepo, HTML Static, PHP, FastAPI, Go HTTP, and Rust Axum. When a framework has variants, the CLI asks for the package manager next.

Each boilerplate includes a `pxxl.boilerplate.json` manifest. The CLI reads that manifest and writes matching `pxxl.toml` defaults for the package manager, framework, port, install command, build command, and start command. It creates a new folder by default for `--new`, validates the project name and selected Pxxl domain suffix, and can deploy the first version immediately.

## CDN

```bash
pxxl cdn summary
pxxl cdn upload ./logo.png
pxxl cdn list
pxxl cdn delete <asset-id>
```

Use `scope=cdn` or `scope=all`.

## Teams / Spaceships

```bash
pxxl team list
pxxl team use <team-id>
pxxl team current
pxxl team clear
```

The selected spaceship is stored in your local Pxxl config. Use `PXXL_TEAM_ID` to override it for scripts and CI.

Use an API key with `scope=team`, `scope=database`, or `scope=all` to list teams.

## Databases

```bash
pxxl db list
pxxl db create --name app-db --type postgres
pxxl db get <database-id>
pxxl db update <database-id> --name new-name
pxxl db start <database-id>
pxxl db stop <database-id>
pxxl db restart <database-id>
pxxl db stats <database-id>
pxxl db tables <database-id>
pxxl db delete <database-id>
```

Database commands accept `--team <team-id>` or use the selected spaceship from `pxxl team use`.
Run `pxxl db create`, `pxxl db get`, `pxxl db start`, `pxxl db stop`, `pxxl db restart`, `pxxl db stats`, `pxxl db tables`, or `pxxl db delete` without an ID to pick from an interactive list.
`pxxl db list` shows only ID, name, type, and status. `pxxl db get` shows connection details including database URL, username, database name, password, host, and port.

Use an API key with `scope=database` or `scope=all`. Listing and read operations work with `permission=read`; create/update/lifecycle/delete require `permission=read_write`.

## Domains

```bash
pxxl domains list
pxxl domains connect example.com --project <project-id>
pxxl domains verify example.com --project <project-id>
pxxl domains records <domain-id>
pxxl domains records add <domain-id> --type A --name @ --value 193.181.212.65
pxxl domains cert <domain-id> --out example.com.pem
pxxl domains activate <domain-id>
pxxl domains stats
pxxl domains stats example.com --timeframe 30d
```

Domain commands use the same Gateway proxy and DNS source as the dashboard. If you omit a selectable target, the CLI fetches your available domains and lets you select one. Bulk connects report accepted domains separately from plan-limit rejections.

## Cron Jobs

```bash
pxxl cron list
pxxl cron create
pxxl cron create --name cleanup --schedule "*/5 * * * *" --url https://example.com/job --method POST
pxxl cron get <cron-job-id>
pxxl cron update <cron-job-id> --schedule "0 * * * *"
pxxl cron stop <cron-job-id>
pxxl cron start <cron-job-id>
pxxl cron trigger <cron-job-id>
pxxl cron runs <cron-job-id>
pxxl cron validate-schedule "*/5 * * * *"
pxxl cron validate-url https://example.com/job
```

Cron commands manage scheduled HTTP jobs through the same worker used by the dashboard. Run `pxxl cron create` without flags to enter an interactive flow for name, schedule, URL, method, timeout, headers, and optional project.

Use an API key with `scope=cron`, `scope=cronjobs`, or `scope=all`. Listing, details, run history, and validation work with `permission=read`; create/update/delete/start/stop/trigger require `permission=read_write`.

Cron jobs use 5-field cron expressions, public `http` or `https` URLs only, request timeouts from 1 to 30 seconds, and `GET`, `POST`, `PUT`, `PATCH`, or `DELETE`. Pxxl blocks private and reserved IP targets. Failed jobs are auto-disabled after repeated failures.
