# Source: https://pxxl.app/docs/quick-fixes/proxy-access-rules

Quick Fixes

# IP, country, method, and content-type access rules

Restrict who can reach a domain and which request shapes the Pxxl proxy accepts.

IP, country, method, and content-type access rules

Share this fix or copy it as Markdown for an LLM.

Share linkCopy as Markdown

Use access rules when a domain should only accept traffic from specific locations, networks, HTTP methods, or content types.

## [Available Rules](https://pxxl.app/#available-rules)

| Rule | Use it for |
| --- | --- |
| **Allowed IPs** | Private dashboards, admin panels, and internal tools. |
| **Blocked IPs** | Known abusive clients or networks. |
| **Allowed Countries** | Region-restricted products or private launches. |
| **Blocked Countries** | Reducing traffic from regions you do not serve. |
| **Allowed Methods** | APIs that should only accept specific methods. |
| **Blocked Methods** | Preventing unused methods like `TRACE` or `DELETE`. |
| **Allowed Content Types** | Restricting uploads or API request bodies. |
| **Blocked Content Types** | Blocking unsupported request formats. |

## [Setup](https://pxxl.app/#setup)

1. Open **Dashboard > Domains**.
2. Select the domain.
3. Open **Settings**.
4. Add the allowlists or blocklists.
5. Click **Save Controls**.
6. Click **Resync Proxy**.

Use allowlists carefully because they can block real users if the list is too narrow.

[WAF checks and rate limits\\ \\ Protect a domain from common attacks and abusive request bursts using Pxxl proxy controls.](https://pxxl.app/docs/quick-fixes/proxy-waf-rate-limits) [Security headers and maintenance mode\\ \\ Add proxy security headers and show a controlled maintenance response without deleting a route.](https://pxxl.app/docs/quick-fixes/proxy-headers-maintenance)

### On this page

[Available Rules](https://pxxl.app/#available-rules) [Setup](https://pxxl.app/#setup)