# Vite React Starter for Pxxl

A deploy-ready React starter for Pxxl with Vite, custom domains, SSL, and global proxy routing.

Deploy this starter on [Pxxl](https://pxxl.app) for custom domains, SSL, logs, global routing, and fast project setup. Read the [Pxxl docs](https://docs.pxxl.app) for CLI, deploy, domains, CDN, and database guides.

## Create and Deploy

```bash
npm install -g @pxxlapp/pxxl
pxxl login --api-key <your-api-key>
pxxl init --new vite-react-pnpm
```

The CLI creates a project folder, writes `pxxl.toml`, lets you choose an eligible Pxxl domain suffix, and can deploy the starter immediately.

## Local Development

```bash
pnpm dev
```

## Deploy Now

Run:

```bash
pxxl deploy
```

Then open your deployment in the Pxxl dashboard: [https://pxxl.app/dashboard](https://pxxl.app/dashboard).
