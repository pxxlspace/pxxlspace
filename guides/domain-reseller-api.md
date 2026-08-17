# Pxxl Domain Reseller API Guide

Use `@pxxlapp/pxxl` to search domains, save customers, create a domain
purchase, and send the customer to a hosted payment page. The same package
also powers the `pxxl` CLI.

## Node SDK

```bash
npm install @pxxlapp/pxxl
```

The grouped `Pxxl` client keeps the workflow easy to follow:

```ts
import { Pxxl } from "@pxxlapp/pxxl";

const pxxl = new Pxxl({ apiKey: process.env.PXXL_API_KEY });

const search = await pxxl.domains.search({ query: "mybrand.cv" });
const prices = await pxxl.domains.listTLDs();
const addons = await pxxl.domains.addons();

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
  domains: [{ domainName: "mybrand.cv", years: 1 }],
});

const payment = await pxxl.invoices.getPaymentUrl(purchase.invoice.id);
console.log(payment.paymentUrl);
```

The SDK sends the saved customer ID as the domain provider contact ID. If the
customer is not saved first, `domains.purchase` also accepts an inline
`contact` and `address` payload when the API workflow requires it.

After checkout, use the invoice methods to retrieve the invoice, create a new
payment URL, pay through a supported provider, cancel an unpaid invoice, or
list purchased domains:

```ts
const invoice = await pxxl.invoices.get(purchase.invoice.id);
const paymentUrl = await pxxl.invoices.paymentUrl(purchase.invoice.id, "NGN");
const purchasedDomains = await pxxl.invoices.purchasedDomains();
```

`PxxlClient` is still exported for existing integrations:

```ts
import { PxxlClient } from "@pxxlapp/pxxl";

const pxxl = new PxxlClient({ apiKey: process.env.PXXL_API_KEY });
const search = await pxxl.searchDomains({ query: "mybrand.cv" });
const invoices = await pxxl.listDomainInvoices();
```

## CLI

The CLI uses the same API client and supports the reseller workflow:

```bash
pxxl domains tlds
pxxl domains search mybrand.cv
pxxl customers create --data '{"firstName":"Ada",...}'
pxxl domains purchase --data '{"customerId":123,"currency":"NGN","domains":[{"domainName":"mybrand.cv","years":1}]}'
pxxl invoices payment-url <invoice-id>
```

Pass `--json` when a script needs the raw response. Keep API keys server-side
or in CI; do not expose them in browser code.

## Domain DNS helpers

The Node SDK also includes provider-independent helpers for DNS lookup and
registration verification:

```ts
const dns = await pxxl.domains.dnsLookup("mybrand.cv");
const verification = await pxxl.domains.verifyRegistration("mybrand.cv");
```

## Rate limits

The Gateway applies route-level rate limits:

- `POST /api/v3/domains/search`: 30 requests per minute.
- `GET /api/v3/domains/tlds`: 60 requests per minute.
- `GET /api/v3/domains/tlds/search`: 30 requests per minute.
- `GET /api/v3/domains/tlds/popular`: 60 requests per minute.

For reseller storefronts, cache TLD pricing for a few minutes and debounce
search input before calling the API.
