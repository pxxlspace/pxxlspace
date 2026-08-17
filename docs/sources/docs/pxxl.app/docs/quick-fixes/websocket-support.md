# Source: https://pxxl.app/docs/quick-fixes/websocket-support

Quick Fixes

# Enable WebSocket support

Allow realtime apps, dashboards, sockets, terminals, and streaming responses through the Pxxl proxy.

Enable WebSocket support

Share this fix or copy it as Markdown for an LLM.

Share linkCopy as Markdown

Use **WebSocket Support** when your app needs upgrade requests, realtime events, terminals, dashboards, or streaming connections.

## [Setup](https://pxxl.app/#setup)

1. Open **Dashboard > Domains**.
2. Select the domain.
3. Open **Settings**.
4. Enable **WebSocket Support**.
5. Click **Save Controls**.
6. Click **Resync Proxy**.
7. Reload the app and test the realtime feature.

## [If It Still Fails](https://pxxl.app/#if-it-still-fails)

Check these first:

- the project port matches the app listener,
- the app listens on `0.0.0.0`, not only `localhost`,
- the deployment is healthy,
- runtime logs do not show socket server errors,
- the browser is connecting to the correct HTTPS hostname.

[Force HTTPS and www redirects\\ \\ Configure HTTPS redirects, root-domain canonical routing, www DNS records, and SSL coverage on Pxxl domains.](https://pxxl.app/docs/quick-fixes/force-https-www) [WAF checks and rate limits\\ \\ Protect a domain from common attacks and abusive request bursts using Pxxl proxy controls.](https://pxxl.app/docs/quick-fixes/proxy-waf-rate-limits)

### On this page

[Setup](https://pxxl.app/#setup) [If It Still Fails](https://pxxl.app/#if-it-still-fails)