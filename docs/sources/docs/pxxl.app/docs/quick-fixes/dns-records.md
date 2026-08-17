# Source: https://pxxl.app/docs/quick-fixes/dns-records

Quick Fixes

# DNS records are wrong or not resolving

Point root domains and subdomains to Pxxl and remove conflicting records.

DNS records are wrong or not resolving

Share this fix or copy it as Markdown for an LLM.

Share linkCopy as Markdown

For domains managed by Pxxl, DNS records are handled from the domain page. For external domains, configure records at your registrar or DNS provider.

## [Required Records](https://pxxl.app/#required-records)

| Goal | Record | Name | Value |
| --- | --- | --- | --- |
| Root domain | A | `@` | `193.181.212.65` |
| Subdomain | A | `app` or your subdomain | `193.181.212.65` |
| Wildcard subdomains | A | `*` | `193.181.212.65` |

## [Avoid Conflicts](https://pxxl.app/#avoid-conflicts)

Avoid duplicate records for the same host. If `@` already has an A record pointing to another server, remove it or replace it with the Pxxl load balancer IP.

## [Propagation](https://pxxl.app/#propagation)

DNS changes can take a few minutes to propagate. If the record is correct but SSL still fails immediately after changing it, wait briefly and click **Resync Proxy** again.

[Connect a domain to a project\\ \\ Attach existing domains, external domains, and subdomains to a Pxxl project.](https://pxxl.app/docs/quick-fixes/connect-domain) [Changed a project port\\ \\ Keep the project port, container labels, and proxy route aligned.](https://pxxl.app/docs/quick-fixes/project-port)

### On this page

[Required Records](https://pxxl.app/#required-records) [Avoid Conflicts](https://pxxl.app/#avoid-conflicts) [Propagation](https://pxxl.app/#propagation)