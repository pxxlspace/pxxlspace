# Pxxl CLI and SDK

Official open-source CLI and SDKs for Pxxl deploys, CDN assets, and domain reseller workflows.

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
pxxl cdn upload ./logo.png
pxxl domain search pxxl.cv
pxxl domain tlds --search cv
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

## Repo Layout

- `src`: Node SDK and `pxxl` CLI.
- `sdks/go/pxxl`: Go SDK.
- `examples`: Node and Go examples.
- `boilerplates`: Pxxl-ready starters for `pxxl init --new`.
- `guides`: API and publishing guides.
- `skills`: safe agent instructions for Pxxl integrations.

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

## Publish to npm

```bash
npm login
npm test
npm run build
npm pack --dry-run
npm version patch
npm publish --access public
```

Use npm 2FA/provenance where available, and smoke test with `npm install -g @pxxlapp/pxxl && pxxl --help`.
