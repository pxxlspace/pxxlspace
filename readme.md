# Pxxl CLI and SDK

Official open-source CLI and SDKs for Pxxl deploys, CDN assets, and domain reseller workflows.

## Install

```bash
npm install -g pxxl
```

## CLI

```bash
pxxl login --api-key pxxl_...
pxxl init --new vite-react-pxxl --name my-app --domain pxxl.pro
pxxl deploy
pxxl cdn upload ./logo.png
pxxl domain search pxxl.cv
pxxl domain tlds --search cv
```

`pxxl deploy` reads `pxxl.toml`, applies `.pxxlignore`, creates a temporary deterministic ZIP, and deploys through Pxxl SpaceDrop.

## Node SDK

```ts
import { PxxlClient } from "pxxl";

const pxxl = new PxxlClient({ apiKey: process.env.PXXL_API_KEY });

const domains = await pxxl.searchDomains({ query: "pxxl.cv" });
const tlds = await pxxl.listTLDs();
const asset = await pxxl.uploadAsset({
  file: new Blob(["hello"]),
  fileName: "hello.txt",
  visibility: "public",
});
```

Domain search returns availability, prices, renewal pricing, and active promo fields such as `.cv` bonus amounts when the API returns them.

## Repo Layout

- `src`: Node SDK and `pxxl` CLI.
- `sdks/go/pxxl`: Go SDK.
- `examples`: Node and Go examples.
- `boilerplates`: Pxxl-ready starters for `pxxl init --new`.
- `guides`: API and publishing guides.
- `skills`: safe agent instructions for Pxxl integrations.

## Publish to npm

```bash
npm login
npm test
npm run build
npm pack --dry-run
npm version patch
npm publish --access public
```

Use npm 2FA/provenance where available, and smoke test with `npm install -g pxxl && pxxl --help`.
