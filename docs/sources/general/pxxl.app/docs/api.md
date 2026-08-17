# Source: https://pxxl.app/docs/api

# API Keys and Platform API

Create scoped API keys, authenticate backend requests, upload CDN files, and connect automation safely.

Pxxl exposes a platform API for backend automation, deployment checks, CDN storage workflows, and integrations that should not run directly inside browser code.

---

## [Postman Collection](https://pxxl.app/#postman-collection)

To quickly explore all available endpoints, download our curated collection of requests:

[Download Pxxl Platform Postman Collection](https://pxxl.app/postman/pxxl-platform.postman_collection.json)

Set the variables `base_url` (e.g., `http://localhost:8080/api/v3` or `https://api.pxxl.app/api/v3`) and `bearer_token` in your Postman environment before sending requests.

---

## [Authentication](https://pxxl.app/#authentication)

All platform requests require your API key passed in the authorization header:

```
Authorization: Bearer YOUR_PLATFORM_API_KEY
```

> \[!CAUTION\] Never distribute your API key inside public code bundles, client-side JavaScript, or mobile applications. Map requests through your own backend server to protect your key.

---

## [Common API Areas](https://pxxl.app/#common-api-areas)

Use the API for server-side automation. Keep API keys in backend secrets and expose only your own controlled endpoints to browsers or mobile clients.

| Area | Typical use |
| --- | --- |
| **Deployments** | Read deployment status, track build results, and connect external monitors. |
| **Projects** | Query project metadata and support internal operations tooling. |
| **CDN** | Upload, list, and audit CDN assets from a backend service. |
| **Usage** | Review workspace usage for reporting or alerts. |
| **OAuth integrations** | Build permissioned integrations that users explicitly authorize. |
| **Webhooks** | Receive signed event notifications when dashboard activity changes. |

---

## [CDN Spaces Endpoints](https://pxxl.app/#cdn-spaces-endpoints)

These endpoints manage file storage, asset audits, and proxy protection analytics:

| HTTP Method | API Path | Objective |
| --- | --- | --- |
| **GET** | `/api/v3/cdn/summary` | Query total bandwidth and remaining wallet credits. |
| **GET** | `/api/v3/cdn/assets` | Paginate through your uploaded asset catalog. |
| **POST** | `/api/v3/cdn/assets` | Upload a new asset to public/private spaces. |
| **GET** | `/api/v3/cdn/proxy-logs` | Retrieve traffic anomaly logs and edge events. |

---

## [Implementation Example (Node.js Fetch)](https://pxxl.app/#implementation-example-nodejs-fetch)

Below is a backend-safe API helper. Keep `PXXL_API_KEY` on the server and call Pxxl from there.

```
const PXXL_API_BASE = process.env.PXXL_API_URL || 'https://gateway.pxxl.dev/api/v3';

async function callPxxl<T>(path: string, options?: RequestInit): Promise<T> {
  const apiKey = process.env.PXXL_API_KEY;
  if (!apiKey) {
    throw new Error('PXXL_API_KEY is not defined in environment variables.');
  }

  const response = await fetch(`${PXXL_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Pxxl API error [${response.status}]: ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

export async function getCdnSummary(): Promise<unknown> {
  return callPxxl('/cdn/summary');
}
```

---

## [API Integration Checklist](https://pxxl.app/#api-integration-checklist)

When writing custom API integrations, verify that your backend handles the following cases:

- [ ] **API Key Scopes:** Ensure your key is limited to the required scopes.
- [ ] **Rate Limiting:** Guard your loops to handle HTTP `429 Too Many Requests` responses gracefully using exponential backoff.
- [ ] **Input Validation:** Validate request payloads before forwarding them to Pxxl.
- [ ] **Token Expiration:** If using OAuth tokens, implement active validation loops to request fresh tokens before executing user actions.

[GitHub Webhooks and Preview Deployments\\ \\ Set up automated, branch-aware code deployments and configure ephemeral pull request environments.](https://pxxl.app/docs/github-previews)

### On this page

[Postman Collection](https://pxxl.app/#postman-collection) [Authentication](https://pxxl.app/#authentication) [Common API Areas](https://pxxl.app/#common-api-areas) [CDN Spaces Endpoints](https://pxxl.app/#cdn-spaces-endpoints) [Implementation Example (Node.js Fetch)](https://pxxl.app/#implementation-example-nodejs-fetch) [API Integration Checklist](https://pxxl.app/#api-integration-checklist)