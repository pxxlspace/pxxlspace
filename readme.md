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
pxxl init --new vite-react-pnpm --name my-app --domain pxxl.pro
pxxl init --new express-bun --name my-api --domain pxxl.pro
pxxl deploy
pxxl redeploy <project-id>
pxxl pull <project-id> ./my-app
pxxl stats
pxxl usage
pxxl env push <project-id> --file .env
pxxl cdn upload ./logo.png
pxxl team list
pxxl team use <team-id>
pxxl db create --name app-db --type postgres
pxxl db list
pxxl db get
pxxl domains list
pxxl domains stats
```

`pxxl login` validates the API key before saving it and prints the authenticated user, scope, and spaceship context. The CLI always uses the official Pxxl Gateway endpoint.
CLI commands print readable terminal output by default. Add `--json` when you need raw API responses for scripts.

`pxxl deploy` reads `pxxl.toml`, applies `.pxxlignore`, creates a temporary deterministic ZIP, and deploys on Pxxl.
`pxxl pull` verifies the local git remote before updating an existing checkout, then refuses to pull into dirty working trees.
`pxxl stats` and `pxxl usage` show deployment, project, artifact, and build-minute usage for the current personal or selected spaceship scope.
`pxxl db create`, `pxxl db get`, database lifecycle commands, `pxxl team use`, `pxxl env push`, and `pxxl domains stats` become interactive when you omit the target value.

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

## Examples

- `examples/node-sdk-functions`: copyable Node functions for deploys, CDN, domains, teams, projects, deployments, databases, env vars, stats, and usage.
- `examples/go-sdk-functions`: copyable Go functions for deploys, CDN, and domain search/pricing.
- `examples/node-cdn-upload`: minimal Node CDN upload.
- `examples/go-cdn-upload`: minimal Go CDN upload.
- `examples/microservices-node`: multi-service Pxxl project example.

## Boilerplates

Run `pxxl init --new` to choose a framework first, then choose a package manager when that framework has variants.

- Express: npm, pnpm, Bun, Yarn.
- Vite React: npm, pnpm, Bun, Yarn.
- Astro, Next.js, Vue Vite, SvelteKit, Fastify, Hono, Node TypeScript.
- FastAPI, Flask, Django, PHP, HTML Static, Go HTTP, Rust Axum, Dockerfile Node.

Direct IDs still work for scripts, for example `express-bun`, `express-npm`, `vite-react-pnpm`, `php-basic`, or `static-cdn-gallery`.

## Useful Links

- CLI docs: [docs.pxxl.app/api/pxxl-cli](https://docs.pxxl.app/api/pxxl-cli)
- Deploy guide: [docs.pxxl.app/api/pxxl-deploy](https://docs.pxxl.app/api/pxxl-deploy)
- CDN guide: [docs.pxxl.app/api/cdn](https://docs.pxxl.app/api/cdn)
- Database API: [docs.pxxl.app/api/database-api](https://docs.pxxl.app/api/database-api)
- Domain reseller SDK: [docs.pxxl.app/api/domain-reseller-sdk](https://docs.pxxl.app/api/domain-reseller-sdk)
