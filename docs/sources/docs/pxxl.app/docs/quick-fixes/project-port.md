# Source: https://pxxl.app/docs/quick-fixes/project-port

Quick Fixes

# Changed a project port

Keep the project port, container labels, and proxy route aligned.

Changed a project port

Share this fix or copy it as Markdown for an LLM.

Share linkCopy as Markdown

If your app listens on a different port, update it in the project settings before redeploying.

## [Fix](https://pxxl.app/#fix)

1. Open the project.
2. Go to **Settings**.
3. Update the port.
4. Redeploy the project.
5. Resync proxy for each connected domain.

The proxy can only route traffic to the port Pxxl registered for the container. If the app listens on a different port inside the container, the route may exist but still show 503.

[DNS records are wrong or not resolving\\ \\ Point root domains and subdomains to Pxxl and remove conflicting records.](https://pxxl.app/docs/quick-fixes/dns-records) [Static site route returns 404\\ \\ Fix nested route behavior for plain HTML sites and SPA builds.](https://pxxl.app/docs/quick-fixes/static-route-404)

### On this page

[Fix](https://pxxl.app/#fix)