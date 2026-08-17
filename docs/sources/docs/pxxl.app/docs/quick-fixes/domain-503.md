# Source: https://pxxl.app/docs/quick-fixes/domain-503

Quick Fixes

# Domain shows 503

Fix unhealthy upstreams, stale proxy routes, and app port mismatches.

Domain shows 503

Share this fix or copy it as Markdown for an LLM.

Share linkCopy as Markdown

A 503 usually means the proxy has a route, but the upstream app is not healthy yet or the registered port does not match the port your app listens on.

## [Check](https://pxxl.app/#check)

- The latest deployment finished successfully.
- The project port in settings matches the port your app listens on.
- The app uses the `PORT` environment variable when possible.
- The domain is attached to the current project.
- The proxy route was resynced after changing the domain or port.

## [Fix](https://pxxl.app/#fix)

1. Open the project.
2. Go to **Settings**.
3. Confirm the port.
4. Redeploy the project if the app image needs the new port.
5. Open the domain and click **Resync Proxy**.

If the proxy error says the registered runtime port is not responding, make sure your app listens on the same port configured in Pxxl.

[SSL certificate is missing or wrong\\ \\ Refresh a domain certificate when HTTPS is missing, expired, or issued for another hostname.](https://pxxl.app/docs/quick-fixes/ssl-certificate) [Domain shows 404\\ \\ Create or refresh the hostname route when DNS points to Pxxl but the proxy has no app route.](https://pxxl.app/docs/quick-fixes/domain-404)

### On this page

[Check](https://pxxl.app/#check) [Fix](https://pxxl.app/#fix)