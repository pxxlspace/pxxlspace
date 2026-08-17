# Source: https://pxxl.app/docs/quick-fixes/ssl-certificate

Quick Fixes

# SSL certificate is missing or wrong

Refresh a domain certificate when HTTPS is missing, expired, or issued for another hostname.

SSL certificate is missing or wrong

Share this fix or copy it as Markdown for an LLM.

Share linkCopy as Markdown

If your domain opens, but the browser says the SSL certificate is missing, expired, or issued for another domain, ask Pxxl to resync the proxy certificate for that domain.

Use **Resync Proxy** when:

- You just pointed a domain to Pxxl.
- You recently connected a domain to a project.
- The site loads over HTTP, but HTTPS is not using the right certificate.
- You bought a domain on Pxxl and the DNS records are correct, but the SSL tab still shows missing coverage.
- You changed the project connected to a domain and want the edge proxy to refresh the route.
- You changed proxy SSL settings such as **Force HTTPS**, `www` redirect behavior, or WebSocket support.

## [Fix](https://pxxl.app/#fix)

1. Open **Dashboard > Domains**.
2. Select the affected domain.
3. Click **Resync Proxy** in the domain actions area.
4. Open the **SSL** tab.
5. Click **Renew / Resync** if you want to check the certificate stage directly.
6. Wait briefly, then reload the domain over `https://`.

Pxxl refreshes the proxy route, requests a dedicated certificate when needed, and serves that certificate using SNI. You do not need to redeploy just to refresh SSL.

For the full list of domain proxy and SSL controls, see [Domain proxy and SSL settings](https://pxxl.app/docs/quick-fixes/domain-proxy-ssl-settings).

| Field | Expected value |
| --- | --- |
| Coverage | Covered |
| TLS | Enabled |
| Browser | No certificate warning |
| URL | `https://yourdomain.com` loads successfully |

[Quick Fixes\\ \\ Direct fixes for common deployment, domain, DNS, SSL, proxy, database, and OAuth issues on Pxxl.](https://pxxl.app/docs/quick-fixes) [Domain shows 503\\ \\ Fix unhealthy upstreams, stale proxy routes, and app port mismatches.](https://pxxl.app/docs/quick-fixes/domain-503)

### On this page

[Fix](https://pxxl.app/#fix)