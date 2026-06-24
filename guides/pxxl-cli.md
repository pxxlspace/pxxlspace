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

The CLI stores credentials at `~/.config/pxxl/config.json` with file mode `0600`.
`PXXL_API_KEY` and `PXXL_API_URL` override the stored config.
`PXXL_TEAM_ID` overrides the selected spaceship/team for scoped commands.

## Deploy

```bash
pxxl init --new vite-react-pxxl --name my-app --domain pxxl.pro
pxxl deploy
```

`pxxl deploy` reads `pxxl.toml`, applies `.pxxlignore`, creates a temporary ZIP, and sends it to Pxxl SpaceDrop.

Use an API key with `scope=all` or `scope=deploy` and `permission=read_write`.

## Boilerplates

```bash
pxxl init --new express-bun-pxxl --name my-api
pxxl init --new hono-bun-pxxl --name edge-api
pxxl init --new fastify-pnpm-pxxl --name fast-api
pxxl init --new nextjs-pnpm-pxxl --name web-app
pxxl init --new astro-npm-pxxl --name docs-site
pxxl init --new vite-react-npm-pxxl --name react-app
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

## Domains

```bash
pxxl domain search pxxl.cv
pxxl domain tlds
pxxl domain tlds --search cv
```

Domain search returns availability, prices, renewal pricing, transfer pricing, restrictions, and promo fields when the API has an active promotion.

## Teams / Spaceships

```bash
pxxl team list
pxxl team use <team-id>
pxxl team current
pxxl team clear
```

The selected spaceship is stored in your local Pxxl config. Use `PXXL_TEAM_ID` to override it for scripts and CI.

Use an API key with `scope=team`, `scope=database`, `scope=deploy`, or `scope=all` to list teams.

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

Use an API key with `scope=database` or `scope=all`. Listing and read operations work with `permission=read`; create/update/lifecycle/delete require `permission=read_write`.
