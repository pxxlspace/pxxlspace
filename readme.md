Deploy your project in seconds.

# Pxxlspace

Pxxlspace is the home of Pxxl's deployment tooling, CLI, JavaScript SDK, and
language SDKs.

- Website: [pxxl.app](https://pxxl.app)
- Documentation: [docs.pxxl.app](https://docs.pxxl.app)
- Dashboard: [pxxl.app/dashboard](https://pxxl.app/dashboard)

## CLI

Install the official CLI and deploy a project:

```bash
npm install -g @pxxlapp/pxxl

pxxl login --api-key pxxl_...
pxxl init --new vite-react-pnpm --name my-app --domain pxxl.pro
cd my-app
pxxl deploy
```

The CLI also handles projects, logs, environment variables, CDN assets,
Storage, domains, invoices, databases, teams, cron jobs, and usage.

## JavaScript SDK

The same package provides the Node.js and TypeScript SDK. The CLI and SDK use
the same API client, so scripts and terminal commands stay in sync.

```bash
npm install @pxxlapp/pxxl
```

```ts
import { Pxxl } from "@pxxlapp/pxxl";

const pxxl = new Pxxl({ apiKey: process.env.PXXL_API_KEY });
const domains = await pxxl.domains.search({ query: "example.com" });
const jobs = await pxxl.cronjobs.list();
```

The JavaScript SDK lives in [`sdks/javascript/pxxl/`](sdks/javascript/pxxl/).
See its [SDK guide](sdks/javascript/pxxl/README.md) and the
[Node examples](examples/node-sdk-functions/README.md).

## Other SDKs

The [`sdks/`](sdks/) directory contains clients for other languages:

| Language | Package | Guide |
| --- | --- | --- |
| Go | `github.com/pxxlspace/pxxlspace/sdks/go/pxxl` | [Go SDK](sdks/go/pxxl/README.md) |
| Python | `pxxl` | [Python SDK](sdks/python/pxxl/README.md) |
| Rust | `pxxl` | [Rust SDK](sdks/rust/pxxl/README.md) |

## Repository map

- [`sdks/`](sdks/) — language SDKs and the JavaScript CLI source.
- [`boilerplates/`](boilerplates/) — starters used by `pxxl init --new`.
- [`examples/`](examples/) — copyable deployment and SDK examples.
- [`guides/`](guides/) — CLI, domain, CDN, database, and npm release guides.

## Development

```bash
npm ci
npm test
npm run build
npm pack --dry-run
```

Use Conventional Commit subjects such as `feat:`, `fix:`, `refactor:`,
`test:`, `docs:`, and `chore:` when contributing.
