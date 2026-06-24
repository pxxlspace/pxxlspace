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
pxxl init --new vite-react-pxxl --name my-app --domain pxxl.pro
pxxl deploy
pxxl redeploy <project-id>
pxxl pull <project-id> ./my-app
pxxl env push <project-id> --file .env
```

`pxxl deploy` reads `pxxl.toml`, applies `.pxxlignore`, creates a temporary ZIP, and sends it to Pxxl SpaceDrop.
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
pxxl init --new express-bun-pxxl --name my-api
pxxl init --new hono-bun-pxxl --name edge-api
pxxl init --new fastify-pnpm-pxxl --name fast-api
pxxl init --new nextjs-pnpm-pxxl --name web-app
pxxl init --new astro-npm-pxxl --name docs-site
pxxl init --new vite-react-npm-pxxl --name react-app
pxxl init --new vue-vite-pnpm-pxxl --name vue-app
pxxl init --new sveltekit-pnpm-pxxl --name svelte-app
pxxl init --new node-typescript-npm-pxxl --name ts-api
pxxl init --new express-yarn-pxxl --name yarn-api
pxxl init --new python-fastapi-pxxl --name fastapi-app
pxxl init --new python-flask-pxxl --name flask-app
pxxl init --new python-django-pxxl --name django-app
pxxl init --new php-basic-pxxl --name php-app
pxxl init --new go-http-pxxl --name go-api
pxxl init --new rust-axum-pxxl --name rust-api
pxxl init --new dockerfile-node-pxxl --name docker-app
```

Each boilerplate includes a `pxxl.boilerplate.json` manifest. The CLI reads that manifest and writes matching `pxxl.toml` defaults for the package manager, framework, port, install command, build command, and start command.

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
pxxl domains stats
pxxl domains stats example.com --timeframe 30d
```

Domain stats use the same Gateway proxy analytics source as the dashboard. If you omit the domain, the CLI fetches your available domains and lets you select one.
