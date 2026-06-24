# Pxxl CLI and SDK

Official CLI and SDK for Pxxl deploys, CDN assets, managed databases, teams, and domain reseller workflows.

- GitHub: [pxxlspace/pxxlspace](https://github.com/pxxlspace/pxxlspace)
- Docs: [docs.pxxl.app](https://docs.pxxl.app)
- Deploy on Pxxl: [pxxl.app](https://pxxl.app)
- Dashboard: [pxxl.app/dashboard](https://pxxl.app/dashboard)

## Install

```bash
npm install -g @pxxlapp/pxxl
```

## CLI

```bash
pxxl login --api-key pxxl_...
pxxl init --new vite-react-pxxl --name my-app --domain pxxl.pro
pxxl init --new express-bun-pxxl --name my-api --domain pxxl.pro
pxxl deploy
pxxl redeploy <project-id>
pxxl pull <project-id> ./my-app
pxxl env push <project-id> --file .env
pxxl cdn upload ./logo.png
pxxl team list
pxxl team use <team-id>
pxxl db create --name app-db --type postgres
pxxl db list
```

`pxxl deploy` reads `pxxl.toml`, applies `.pxxlignore`, creates a temporary deterministic ZIP, and deploys through Pxxl SpaceDrop.

## Node SDK

```ts
import { PxxlClient } from "@pxxlapp/pxxl";

const pxxl = new PxxlClient({ apiKey: process.env.PXXL_API_KEY });

const domains = await pxxl.searchDomains({ query: "pxxl.cv" });
const tlds = await pxxl.listTLDs();
const invoices = await pxxl.listDomainInvoices();
const teams = await pxxl.listTeams();
const database = await pxxl.createDatabase({ name: "app-db", type: "postgres" });
const asset = await pxxl.uploadAsset({
  file: new Blob(["hello"]),
  fileName: "hello.txt",
  visibility: "public",
});
```

Domain search returns availability, prices, renewal pricing, and active promo fields such as `.cv` bonus amounts when the API returns them.
Database commands use the same managed database provisioning API as the dashboard. Use `pxxl team use <team-id>` or `PXXL_TEAM_ID` to create/list databases inside a spaceship.

## Boilerplates

- `static-cdn-gallery`: static HTML/CSS gallery.
- `vite-react-pxxl`: Vite React with pnpm.
- `vite-react-npm-pxxl`: Vite React with npm.
- `express-api-pxxl`: Express API with npm.
- `express-bun-pxxl`: Express API with Bun.
- `hono-bun-pxxl`: Hono API with Bun.
- `fastify-pnpm-pxxl`: Fastify API with pnpm.
- `nextjs-pnpm-pxxl`: Next.js App Router with pnpm.
- `astro-npm-pxxl`: Astro site with npm.

## Useful Links

- CLI docs: [docs.pxxl.app/api/pxxl-cli](https://docs.pxxl.app/api/pxxl-cli)
- Deploy guide: [docs.pxxl.app/api/pxxl-deploy](https://docs.pxxl.app/api/pxxl-deploy)
- CDN guide: [docs.pxxl.app/api/cdn](https://docs.pxxl.app/api/cdn)
- Database API: [docs.pxxl.app/api/database-api](https://docs.pxxl.app/api/database-api)
- Domain reseller SDK: [docs.pxxl.app/api/domain-reseller-sdk](https://docs.pxxl.app/api/domain-reseller-sdk)
