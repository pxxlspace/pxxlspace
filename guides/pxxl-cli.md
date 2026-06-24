# Pxxl CLI Guide

The root `pxxl` npm package ships one binary:

```bash
npm install -g pxxl
pxxl --help
```

## Login

```bash
pxxl login --api-key pxxl_...
```

The CLI stores credentials at `~/.config/pxxl/config.json` with file mode `0600`.
`PXXL_API_KEY` and `PXXL_API_URL` override the stored config.

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
