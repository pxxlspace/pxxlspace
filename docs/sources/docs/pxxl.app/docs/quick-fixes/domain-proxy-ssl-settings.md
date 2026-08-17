# Source: https://pxxl.app/docs/quick-fixes/domain-proxy-ssl-settings

Quick Fixes

# Domain proxy and SSL settings

Configure domain SSL, HTTPS redirects, www behavior, WebSocket support, WAF checks, rate limits, headers, and proxy resync.

Domain proxy and SSL settings

Share this fix or copy it as Markdown for an LLM.

Share linkCopy as Markdown

Use this page when a domain is connected to a Pxxl project and you want to control how the edge proxy handles HTTPS, certificates, `www`, WebSockets, security rules, and traffic limits.

Open **Dashboard > Domains**, select the domain, then use the **SSL** and **Settings** tabs.

## [SSL Controls](https://pxxl.app/#ssl-controls)

| Control | What it does | When to use it |
| --- | --- | --- |
| **SSL Status** | Shows whether the current certificate covers the domain. | Check this after connecting a domain, changing DNS, or seeing a browser certificate warning. |
| **Resync Proxy** | Refreshes the route, upstream target, and certificate request. | Use after changing DNS, connected project, port, proxy rules, or SSL state. |
| **Renew / Resync** | Rechecks certificate coverage and expiry from the SSL tab. | Use when HTTPS is missing, expired, or issued for the wrong hostname. |
| **Force HTTPS** | Redirects plain HTTP traffic to HTTPS. | Enable for production domains once SSL is covered. |
| **Force www Redirect** | Sends `www.yourdomain.com` traffic to the root domain when enabled. | Enable when you want one canonical hostname and do not want duplicate `www` traffic. |

If `www` should work, make sure DNS has a `www` record that points to Pxxl or aliases the root domain. After that, run **Resync Proxy** so the certificate request includes the needed hostname coverage.

## [Proxy Route Controls](https://pxxl.app/#proxy-route-controls)

These controls apply before traffic reaches your project container.

| Setting | What it changes |
| --- | --- |
| **WebSocket Support** | Allows upgrade requests for realtime apps, dashboards, sockets, terminals, and streaming responses. |
| **Security Headers** | Adds baseline browser protection headers from the edge. |
| **Maintenance Mode** | Returns a controlled maintenance response without deleting the project route. |
| **Rate Limiting** | Throttles abusive clients by route, IP, or domain. |
| **WAF Checks** | Blocks common SQL injection, XSS, path traversal, and bad bot patterns. |
| **Allowed / Blocked IPs** | Restricts access by IP address or CIDR range. |
| **Allowed / Blocked Countries** | Restricts access by country code. |
| **HTTP Methods** | Allows or blocks methods such as `GET`, `POST`, `PUT`, or `DELETE`. |
| **Content Types** | Limits accepted request content types for the route. |
| **Request Headers** | Adds controlled headers before traffic reaches your app. |
| **Response Headers** | Adds controlled headers before responses leave the proxy. |
| **Circuit Breaker** | Temporarily pauses routing after repeated upstream failures. |
| **Retry Upstream Errors** | Retries temporary `502`, `503`, and `504` upstream responses. |
| **In-flight Limit** | Caps concurrent requests for the route. |

## [Detailed Guides](https://pxxl.app/#detailed-guides)

Use these when you want the exact setup path for one part of the proxy:

- [Force HTTPS and www redirects](https://pxxl.app/docs/quick-fixes/force-https-www)
- [WebSocket support](https://pxxl.app/docs/quick-fixes/websocket-support)
- [WAF checks and rate limits](https://pxxl.app/docs/quick-fixes/proxy-waf-rate-limits)
- [Access rules](https://pxxl.app/docs/quick-fixes/proxy-access-rules)
- [Headers and maintenance mode](https://pxxl.app/docs/quick-fixes/proxy-headers-maintenance)
- [Upstream protection](https://pxxl.app/docs/quick-fixes/proxy-upstream-protection)

## [Safe Update Order](https://pxxl.app/#safe-update-order)

1. Confirm the domain DNS points to Pxxl.
2. Confirm the domain is connected to the correct project.
3. Open **SSL** and run **Resync Proxy**.
4. Open **Settings** and update the proxy controls.
5. Save the settings.
6. Run **Resync Proxy** again.
7. Test the root domain and `www` hostname over `https://`.

## [What Resync Proxy Does](https://pxxl.app/#what-resync-proxy-does)

**Resync Proxy** asks Pxxl to refresh the domain route in the edge proxy. It does not rebuild your project. It updates the routing layer so the proxy can re-read:

- the connected project,
- the upstream target and project port,
- SSL certificate coverage,
- `www` handling,
- HTTPS redirect behavior,
- WebSocket settings,
- security and traffic rules.

## [Common Symptoms](https://pxxl.app/#common-symptoms)

| Symptom | What to check first |
| --- | --- |
| Browser shows the wrong certificate | Open **SSL**, then run **Resync Proxy**. |
| `www` does not load | Check the `www` DNS record, then run **Resync Proxy**. |
| HTTP works but HTTPS warns | Confirm SSL coverage and enable **Force HTTPS** only after coverage is ready. |
| Realtime sockets fail | Enable **WebSocket Support**. |
| Good users are blocked | Review country, IP, method, content-type, and WAF rules. |
| Domain returns `503` | Check the project port and live upstream before changing SSL rules. |

[Lock down a domain\\ \\ Apply proxy security controls such as HTTPS, WAF checks, rate limits, headers, and maintenance mode.](https://pxxl.app/docs/quick-fixes/domain-security) [Force HTTPS and www redirects\\ \\ Configure HTTPS redirects, root-domain canonical routing, www DNS records, and SSL coverage on Pxxl domains.](https://pxxl.app/docs/quick-fixes/force-https-www)

### On this page

[SSL Controls](https://pxxl.app/#ssl-controls) [Proxy Route Controls](https://pxxl.app/#proxy-route-controls) [Detailed Guides](https://pxxl.app/#detailed-guides) [Safe Update Order](https://pxxl.app/#safe-update-order) [What Resync Proxy Does](https://pxxl.app/#what-resync-proxy-does) [Common Symptoms](https://pxxl.app/#common-symptoms)