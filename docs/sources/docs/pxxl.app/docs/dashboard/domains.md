# Source: https://pxxl.app/docs/dashboard/domains

Dashboard

# Manage Domains

Search domains, open a domain detail page, manage DNS, subdomains, nameservers, SSL, and settings using robinsonhonour.cv as an example.

Open **Dashboard > Domain** to view every registered or connected domain in the workspace.

![Domain list](https://cdn.pxxl.app/docs/dashboard-screenshots/28-domains-list.png)

## [Find A Domain](https://pxxl.app/#find-a-domain)

Use the search field when the account has many domains. This example uses `robinsonhonour.cv`.

![Search for robinsonhonour.cv](https://cdn.pxxl.app/docs/dashboard-screenshots/29-domain-search-robinsonhonour-cv.png)

Select the domain row to open its detail workspace.

![robinsonhonour.cv overview](https://cdn.pxxl.app/docs/dashboard-screenshots/30-domain-overview-robinsonhonour-cv.png)

## [Domain Detail Tabs](https://pxxl.app/#domain-detail-tabs)

| Tab | Use it for |
| --- | --- |
| **Overview** | Current domain status, connected project, route state, and top-level domain information. |
| **DNS** | DNS records and record creation when Pxxl DNS is active. |
| **Subdomains** | Subdomain routing and project connections. |
| **Nameserver** | Nameserver provider, Pxxl DNS setup, and registrar instructions. |
| **SSL** | Certificate status, renewal, and proxy resync checks. |
| **Settings** | Domain metadata, ownership, renewal, and high-impact domain controls. |

For a focused reference on certificate coverage, force HTTPS, `www` redirect behavior, WebSocket support, WAF checks, headers, and proxy resync, see [Domain proxy and SSL settings](https://pxxl.app/docs/quick-fixes/domain-proxy-ssl-settings).

## [DNS Records](https://pxxl.app/#dns-records)

![robinsonhonour.cv DNS tab](https://cdn.pxxl.app/docs/dashboard-screenshots/31-domain-dns-robinsonhonour-cv.png)

Use **DNS** to review records when Pxxl manages the zone. If the domain uses custom nameservers, switch to **Nameserver** to see what must change before Pxxl can manage records.

To create a record, open **New Record**.

![New DNS record form](https://cdn.pxxl.app/docs/dashboard-screenshots/36-domain-new-dns-record-robinsonhonour-cv.png)

Common record types:

| Type | Use |
| --- | --- |
| **A** | Point a hostname to an IPv4 address. |
| **AAAA** | Point a hostname to an IPv6 address. |
| **CNAME** | Alias one hostname to another hostname. |
| **TXT** | Verification, SPF, DKIM, DMARC, and provider metadata. |
| **MX** | Email routing. |

Do not save a DNS record until the name, type, value, TTL, and proxy setting are correct.

## [Subdomains](https://pxxl.app/#subdomains)

![robinsonhonour.cv subdomains tab](https://cdn.pxxl.app/docs/dashboard-screenshots/32-domain-subdomains-robinsonhonour-cv.png)

Use **Subdomains** to review subdomain routing. This is useful when the root domain and `www` route to different projects or when staging subdomains exist.

## [Nameservers](https://pxxl.app/#nameservers)

![robinsonhonour.cv nameserver tab](https://cdn.pxxl.app/docs/dashboard-screenshots/33-domain-nameserver-robinsonhonour-cv.png)

Use **Nameserver** to see whether Pxxl DNS or external nameservers control the zone. DNS records can only be managed inside Pxxl when nameservers are configured for Pxxl DNS.

## [SSL](https://pxxl.app/#ssl)

![robinsonhonour.cv SSL tab](https://cdn.pxxl.app/docs/dashboard-screenshots/34-domain-ssl-robinsonhonour-cv.png)

Use **SSL** to confirm certificate coverage and renew or resync certificate state. If HTTPS shows the wrong certificate, verify DNS first, then resync SSL/proxy.

## [Settings](https://pxxl.app/#settings)

![robinsonhonour.cv settings tab](https://cdn.pxxl.app/docs/dashboard-screenshots/35-domain-settings-robinsonhonour-cv.png)

Use **Settings** for domain-level metadata and high-impact controls. The page is split into collapsible sections so you can review ownership, invoices, proxy controls, transfers, and destructive actions without mixing them together.

### [Connected Project](https://pxxl.app/#connected-project)

The connected project is the app that receives traffic for the domain. If no project is connected, DNS can still be managed, but the proxy does not know which app should answer requests for the hostname.

Use **Resync Proxy** after changing the connected project, changing a project port, or refreshing SSL coverage. Resync asks the edge proxy to re-read the domain route and certificate state.

### [Registrant Details](https://pxxl.app/#registrant-details)

| Field | Meaning |
| --- | --- |
| **Registrant** | The legal contact name stored for the domain registration. |
| **Email** | The registrant email address used by the registrar for ownership and policy notices. |
| **Duration** | The number of years purchased for the registration period. |
| **Status** | The current registration workflow state stored by Pxxl. |
| **WHOIS Privacy** | Whether public WHOIS details are hidden by registrar privacy. |
| **Registered** | Whether the registrar has confirmed that the domain is registered. |

### [Invoice Details](https://pxxl.app/#invoice-details)

| Field | Meaning |
| --- | --- |
| **Status** | The payment state for the invoice, such as pending, paid, cancelled, or failed. |
| **Currency** | The invoice currency used at checkout. |
| **Total** | The subtotal before tax. |
| **Tax** | The tax amount calculated for the invoice. |
| **Grand Total** | The final amount charged after tax. |
| **Paid At** | The time the invoice was marked paid. |

### [Proxy Security Controls](https://pxxl.app/#proxy-security-controls)

Proxy security controls apply at Pxxl's edge before traffic reaches your app container.

| Control | What it does |
| --- | --- |
| **Force HTTPS** | Redirects HTTP traffic to HTTPS and requires secure requests where possible. |
| **Force www Redirect** | Redirects `www.yourdomain.com` to the root domain when you want one canonical hostname. |
| **WebSocket Support** | Allows upgrade requests for realtime apps, dashboards, sockets, and streams. |
| **Security Headers** | Adds baseline browser security headers from the edge. |
| **Maintenance Mode** | Shows a controlled maintenance response without deleting the project route. |
| **Rate Limiting** | Slows abusive clients by request count per IP, per domain, or per path. |
| **WAF Rules** | Blocks common SQL injection, XSS, path traversal, and bad bot patterns. |
| **Allowed / Blocked IPs** | Restricts traffic by IP address or CIDR range. |
| **Allowed / Blocked Countries** | Restricts traffic by country code. |
| **Methods and Content Types** | Limits HTTP methods or request content types accepted by the route. |
| **Request / Response Headers** | Adds headers before traffic reaches your app or before responses leave the proxy. |
| **Circuit Breaker** | Pauses routing briefly after repeated upstream failures. |
| **In-flight Limit** | Caps concurrent requests for the route. |
| **Retry Upstream Errors** | Retries temporary 502, 503, and 504 responses. |

Save changes, then use **Resync Proxy** to push the latest controls to the active route.

If a certificate is missing for the root domain or `www` hostname, confirm DNS first, then run **Resync Proxy** from the domain page. Pxxl refreshes the route and certificate state without requiring a project rebuild.

### [Transfer Domain](https://pxxl.app/#transfer-domain)

Use transfer when a Pxxl-purchased domain should move to another Pxxl account. The sender chooses the recipient email. The recipient accepts with the transfer code and enters their own registrant contact details.

### [Danger Zone](https://pxxl.app/#danger-zone)

The danger zone appears for external domains. Deleting an external domain removes it from your Pxxl dashboard and route configuration, but it does not delete the domain from your registrar.

## [Safe Domain Update Pattern](https://pxxl.app/#safe-domain-update-pattern)

1. Search and open the domain.
2. Confirm you are in the correct workspace.
3. Review **Overview** and the connected project.
4. Check **Nameserver** before editing DNS.
5. Add or update DNS records.
6. Confirm SSL after DNS resolves.
7. Use project-level **Domains** only for app routing; use domain detail tabs for DNS, nameserver, and SSL.

[Importing Projects\\ \\ Import existing Vercel, Netlify, Render, or Railway projects into Pxxl using provider access keys.](https://pxxl.app/docs/dashboard/import-projects) [Database\\ \\ Create managed databases from the dashboard, link them to projects, and expose the right connection values to your running containers.](https://pxxl.app/docs/dashboard/database)

### On this page

[Find A Domain](https://pxxl.app/#find-a-domain) [Domain Detail Tabs](https://pxxl.app/#domain-detail-tabs) [DNS Records](https://pxxl.app/#dns-records) [Subdomains](https://pxxl.app/#subdomains) [Nameservers](https://pxxl.app/#nameservers) [SSL](https://pxxl.app/#ssl) [Settings](https://pxxl.app/#settings) [Connected Project](https://pxxl.app/#connected-project) [Registrant Details](https://pxxl.app/#registrant-details) [Invoice Details](https://pxxl.app/#invoice-details) [Proxy Security Controls](https://pxxl.app/#proxy-security-controls) [Transfer Domain](https://pxxl.app/#transfer-domain) [Danger Zone](https://pxxl.app/#danger-zone) [Safe Domain Update Pattern](https://pxxl.app/#safe-domain-update-pattern)