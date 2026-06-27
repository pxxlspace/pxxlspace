# Turbo Monorepo Starter for Pxxl

A deploy-ready Turborepo workspace with a Vite web app, an Express API, and a shared package.

- Web app: `apps/web`
- API service: `apps/api`
- Shared package: `packages/ui`
- Package manager: pnpm

Deploy this starter on [Pxxl](https://pxxl.app) for custom domains, SSL, logs, global proxy routing, and multi-service project setup. Read the [Pxxl docs](https://docs.pxxl.app) for CLI, deploy, domains, CDN, database, and cron guides.

## Create and Deploy

```bash
npm install -g @pxxlapp/pxxl
pxxl login --api-key <your-api-key>
pxxl init --new turbo-monorepo
```

The CLI creates a project folder, writes `pxxl.toml`, lets you choose an eligible Pxxl domain suffix, and can deploy the starter immediately.

## Local Development

```bash
pnpm install
pnpm dev
```

## Deploy Now

Run:

```bash
pxxl deploy
```

Then open your deployment in the Pxxl dashboard: [https://pxxl.app/dashboard](https://pxxl.app/dashboard).
