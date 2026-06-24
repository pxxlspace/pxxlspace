# Pxxl Domain Reseller API Guide

Use the `pxxl` SDK or CLI to search domains, fetch TLD pricing, and display active promotions.

## CLI

```bash
pxxl login --api-key pxxl_...
pxxl domain search pxxl.cv
pxxl domain tlds
pxxl domain tlds --search cv
```

Domain search uses Pxxl's public, rate-limited search path. It returns availability, provider status, USD/NGN registration and renewal prices, minimum registration periods, and active promo fields such as `.cv` bonus amounts.

## Node SDK

```ts
import { PxxlClient } from "pxxl";

const pxxl = new PxxlClient({ apiKey: process.env.PXXL_API_KEY });

const search = await pxxl.searchDomains({ query: "mybrand.cv" });
const prices = await pxxl.listTLDs();
```

## Rate Limits

The Gateway applies route-level rate limits:

- `POST /api/v3/domains/search`: 30 requests per minute.
- `GET /api/v3/domains/tlds`: 60 requests per minute.
- `GET /api/v3/domains/tlds/search`: 30 requests per minute.
- `GET /api/v3/domains/tlds/popular`: 60 requests per minute.

For production reseller storefronts, cache TLD pricing for a few minutes and debounce search input before calling the API.
