# Source: https://pxxl.app/docs/quick-fixes/domain-404

Quick Fixes

# Domain shows 404

Create or refresh the hostname route when DNS points to Pxxl but the proxy has no app route.

Domain shows 404

Share this fix or copy it as Markdown for an LLM.

Share linkCopy as Markdown

A 404 usually means the domain has DNS pointing to Pxxl, but the proxy route has not been created for that hostname.

## [Fix](https://pxxl.app/#fix)

1. Connect the domain to a project.
2. Confirm the domain appears in the project **Domains** tab.
3. Click **Resync Proxy** from the domain detail page.
4. Check that the latest deployment is active.

If the domain was just created, give the system a short moment to finish DNS and proxy setup, then refresh.

[Domain shows 503\\ \\ Fix unhealthy upstreams, stale proxy routes, and app port mismatches.](https://pxxl.app/docs/quick-fixes/domain-503) [Connect a domain to a project\\ \\ Attach existing domains, external domains, and subdomains to a Pxxl project.](https://pxxl.app/docs/quick-fixes/connect-domain)

### On this page

[Fix](https://pxxl.app/#fix)