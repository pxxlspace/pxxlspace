# Source: https://pxxl.app/docs/quick-fixes/proxy-headers-maintenance

Quick Fixes

# Security headers and maintenance mode

Add proxy security headers and show a controlled maintenance response without deleting a route.

Security headers and maintenance mode

Share this fix or copy it as Markdown for an LLM.

Share linkCopy as Markdown

Use **Security Headers** to add baseline browser protection at the edge.

Use **Maintenance Mode** when you want the proxy to return a planned maintenance response while keeping the route intact.

## [Setup](https://pxxl.app/#setup)

1. Open **Dashboard > Domains**.
2. Select the domain.
3. Open **Settings**.
4. Enable **Security Headers** or **Maintenance Mode**.
5. Set a maintenance status code if needed.
6. Click **Save Controls**.
7. Click **Resync Proxy**.

## [Custom Headers](https://pxxl.app/#custom-headers)

You can also add controlled request or response headers at the proxy. Use this for headers your app needs consistently, but avoid adding secrets or private tokens as public response headers.

[IP, country, method, and content-type access rules\\ \\ Restrict who can reach a domain and which request shapes the Pxxl proxy accepts.](https://pxxl.app/docs/quick-fixes/proxy-access-rules) [Circuit breaker, retries, and in-flight limits\\ \\ Protect unhealthy upstreams with route-level retry, circuit breaker, and concurrency controls.](https://pxxl.app/docs/quick-fixes/proxy-upstream-protection)

### On this page

[Setup](https://pxxl.app/#setup) [Custom Headers](https://pxxl.app/#custom-headers)