# Pxxl JavaScript SDK

The `@pxxlapp/pxxl` package gives Node.js and TypeScript applications one
client for the Pxxl platform. It also installs the `pxxl` command-line tool.

Keep API keys on a server, worker, or CI job. Do not expose them in browser
bundles.

## Install

```bash
npm install @pxxlapp/pxxl
```

## Use the unified client

```ts
import { Pxxl } from "@pxxlapp/pxxl";

const pxxl = new Pxxl({
  apiKey: process.env.PXXL_API_KEY,
});

const assets = await pxxl.cdn.list();
const buckets = await pxxl.storage.listBuckets();
const objects = await pxxl.storage.listObjects("bucket_123");
const jobs = await pxxl.cronjobs.list();
```

The grouped client includes:

- `identity` and `api` for account details and direct API requests.
- `cdn` / `assets` for files, proxy logs, usage, and edge functions.
- `storage` for buckets, objects, S3 access keys, analytics, and billing.
- `domains` for TLD prices, availability, registration, DNS, nameservers,
  certificates, custom-domain connections, and domain orders.
- `customers` for saved registrant contacts used during domain checkout.
- `invoices` for domain invoice details, payment URLs, payment providers,
  cancellation, and purchased domains.
- `billing` for invoices and payment links.
- `cronjobs` / `cron` for scheduled HTTP jobs, validation, lifecycle actions,
  manual triggers, and run history.
- `projects`, `deployments`, `env`, `databases`, `teams`, and `analytics` for the same
  platform operations available through the CLI.
- `mcp` for Pxxl tools and resources over MCP.

`PxxlClient` is also exported. It keeps the original flat method names for
existing integrations, while `Pxxl` adds the grouped resource API.

## Buy a domain

Save a customer once, use its returned ID to create the domain invoice, then
send the customer to the hosted payment page.

```ts
const customer = await pxxl.customers.create({
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "+2348000000000",
  address1: "1 Example Street",
  city: "Lagos",
  state: "Lagos",
  postalCode: "100001",
  country: "NG",
});

const purchase = await pxxl.domains.purchase({
  customerId: customer.id,
  currency: "NGN",
  domains: [{ domainName: "example.com", years: 1 }],
});

const payment = await pxxl.invoices.getPaymentUrl(purchase.invoice.id);
console.log(payment.paymentUrl);
```

Payment URLs can expire. Request a fresh URL when needed, and use the invoice
ID to check status instead of repeating a purchase after a timeout.

Storage objects use the same authenticated API client:

```ts
const object = await pxxl.storage.uploadObject("bucket_123", {
  file: new Blob(["hello"]),
  fileName: "hello.txt",
  path: "greetings",
  visibility: "private",
});

await pxxl.storage.deleteObject(object.id);
```

For older billing records, use the separate billing resource:

```ts
const invoices = await pxxl.billing.list({ status: "pending" });
const details = await pxxl.billing.get("invoice_123");
```

## Cron jobs

```ts
const job = await pxxl.cronjobs.create({
  name: "refresh-orders",
  schedule: "*/15 * * * *",
  url: "https://example.com/api/cron/refresh-orders",
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  timeoutSeconds: 30,
});

await pxxl.cronjobs.trigger(job.id);
const runs = await pxxl.cronjobs.runs(job.id, { limit: 20 });
```

Cron endpoints must be public over HTTP or HTTPS. Authenticate requests with a
secret, make handlers safe to retry, and move long work to a queue.

## CLI

```bash
npm install -g @pxxlapp/pxxl
pxxl login --api-key pxxl_...
pxxl deploy

pxxl storage buckets
pxxl domains search example.com
pxxl customers create --data '{"firstName":"Ada",...}'
pxxl invoices payment-url <invoice-id>
pxxl cron create --name refresh --schedule '*/15 * * * *' --url https://example.com/cron
```

Run `pxxl --help` or see the [`Pxxl CLI docs`](../../../docs/integrations/cli/overview.mdx)
for the full command list.

## Development

From the repository root:

```bash
npm ci
npm test
npm run build
npm pack --dry-run
```

The source and tests for this package are in this directory. Publishing steps
are documented in the [`SDK publishing guide`](../../../docs/integrations/sdk/publishing.mdx).
