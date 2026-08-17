# Source: https://pxxl.app/docs/cdn-proxy

# CDN and Proxy Logs

Orchestrate file storage spaces, upload assets via CLI, and analyze real-time proxy traffic and security events.

Pxxl combines object storage with edge-routing protection, enabling teams to host application assets and monitor visitor routing patterns from a single dashboard.

---

## [CDN Spaces](https://pxxl.app/#cdn-spaces)

A CDN Space is an isolated bucket configured to store application resources. Spaces categorize files using access parameters:

- **Public Assets:** Served directly from our edge cache nodes with optimal HTTP headers for static images, stylesheets, and client binaries.
- **Private Assets:** Accessed via pre-signed, short-lived URLs. Use this for user uploads, transaction reports, and internal file processing.
- **Build Artifacts:** Archived container images and compiled packages preserved for fast version rollbacks.

---

## [Uploading Assets via API](https://pxxl.app/#uploading-assets-via-api)

To upload a file directly to your public storage space:

```
curl -X POST https://gateway.pxxl.dev/api/v3/cdn/assets \
  -H "Authorization: Bearer $PXXL_API_KEY" \
  -F "file=@./static/logo.png" \
  -F "visibility=public"
```

### [Checking Usage Summaries](https://pxxl.app/#checking-usage-summaries)

Track storage limits and monthly network egress consumption:

```
curl -H "Authorization: Bearer $PXXL_API_KEY" \
  https://gateway.pxxl.dev/api/v3/cdn/summary
```

The response returns:

- `activeSpaceCount`: Total created spaces.
- `bandwidthBytesOut`: Egress bytes served from cache nodes.
- `totalObjectsStored`: Total count of files.
- `remainingCredits`: Wallet currency available for CDN upgrades.

---

## [Proxy Protection Logs](https://pxxl.app/#proxy-protection-logs)

Navigate to your project overview and select **Proxy Logs** to analyze real-time HTTP traffic routed by the Rust reverse proxy.

### [Metrics Definitions](https://pxxl.app/#metrics-definitions)

| Metric | Target Measurement |
| --- | --- |
| **Allowed Requests** | Safe HTTP requests forwarded successfully to your container upstream. |
| **Blocked Requests** | Malicious or non-compliant requests rejected at the edge proxy. |
| **Risk Index** | A security rating (Low, Medium, High) derived from blocked ratios, rapid IP spikes, and security rule triggers. |
| **GeoIP Concentration** | Demographics showing visitor counts grouped by country and region. |
| **Top IP Sources** | Monitored IP addresses contributing the highest traffic volumes. |

---

## [DDoS Mitigation and Security Rules](https://pxxl.app/#ddos-mitigation-and-security-rules)

The Rust edge proxy uses rule engines to intercept threats before they reach your runtime container:

1. **Rate Limiting (Token Bucket):** Restricts requests per second on a per-IP basis. If a source exceeds the threshold, the proxy returns `429 Too Many Requests`.
2. **IP Blacklisting:** Rejects requests coming from known malicious subnets or manual blacklist configurations.
3. **Geo-Blocking:** Blocks traffic coming from restricted regions defined in your project settings.
4. **Anomaly Detection:** Flags rapid, concentrated spikes on inactive domains or endpoints that do not match search-engine bot signatures.

---

## [Operational Best Practices](https://pxxl.app/#operational-best-practices)

To maintain performance and keep hosting costs predictable, follow these practices:

- **Cache Assets:** Serve static files directly from CDN spaces instead of bundling them inside your project container.
- **Monitor IP Patterns:** Audit top IP sources weekly to detect scraping or automated script attacks.
- **Set Egress Alerts:** Set up email alerts in your billing tab to notify you when bandwidth egress exceeds 80% of your current tier limit.
- **Rotate Keys:** Rotate CDN upload API keys immediately if they are accidentally exposed in client bundles or public build systems.

[OAuth Integrations\\ \\ Create OAuth integrations, configure callbacks, request user consent, exchange authorization codes, and read public Pxxl user data.](https://pxxl.app/docs/integrations/oauth) [GitHub Webhooks and Preview Deployments\\ \\ Set up automated, branch-aware code deployments and configure ephemeral pull request environments.](https://pxxl.app/docs/github-previews)

### On this page

[CDN Spaces](https://pxxl.app/#cdn-spaces) [Uploading Assets via API](https://pxxl.app/#uploading-assets-via-api) [Checking Usage Summaries](https://pxxl.app/#checking-usage-summaries) [Proxy Protection Logs](https://pxxl.app/#proxy-protection-logs) [Metrics Definitions](https://pxxl.app/#metrics-definitions) [DDoS Mitigation and Security Rules](https://pxxl.app/#ddos-mitigation-and-security-rules) [Operational Best Practices](https://pxxl.app/#operational-best-practices)