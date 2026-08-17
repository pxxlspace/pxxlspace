# Source: https://pxxl.app/docs/quick-fixes/proxy-upstream-protection

Quick Fixes

# Circuit breaker, retries, and in-flight limits

Protect unhealthy upstreams with route-level retry, circuit breaker, and concurrency controls.

Circuit breaker, retries, and in-flight limits

Share this fix or copy it as Markdown for an LLM.

Share linkCopy as Markdown

Use upstream protection when a project is temporarily unhealthy, overloaded, or returning intermittent `502`, `503`, and `504` responses.

## [Controls](https://pxxl.app/#controls)

| Control | What it does |
| --- | --- |
| **Circuit Breaker** | Pauses routing briefly after repeated upstream failures. |
| **Retry Upstream Errors** | Retries temporary `502`, `503`, and `504` responses. |
| **In-flight Limit** | Caps concurrent requests for the route. |

## [Setup](https://pxxl.app/#setup)

1. Open **Dashboard > Domains**.
2. Select the domain.
3. Open **Settings**.
4. Configure upstream protection.
5. Click **Save Controls**.
6. Click **Resync Proxy**.
7. Watch usage and proxy analytics after enabling.

Do not use retries to hide a broken app port. If every request fails, fix the deployment or project port first.

[Security headers and maintenance mode\\ \\ Add proxy security headers and show a controlled maintenance response without deleting a route.](https://pxxl.app/docs/quick-fixes/proxy-headers-maintenance) [OAuth Integrations\\ \\ Create OAuth integrations, configure callbacks, request user consent, exchange authorization codes, and read public Pxxl user data.](https://pxxl.app/docs/integrations/oauth)

### On this page

[Controls](https://pxxl.app/#controls) [Setup](https://pxxl.app/#setup)