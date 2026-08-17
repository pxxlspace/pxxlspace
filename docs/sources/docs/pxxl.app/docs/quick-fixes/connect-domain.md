# Source: https://pxxl.app/docs/quick-fixes/connect-domain

Quick Fixes

# Connect a domain to a project

Attach existing domains, external domains, and subdomains to a Pxxl project.

Connect a domain to a project

Share this fix or copy it as Markdown for an LLM.

Share linkCopy as Markdown

Domains only receive traffic after they are attached to a project. Purchasing a domain and deploying a project are separate actions.

## [From The Project](https://pxxl.app/#from-the-project)

1. Open **Dashboard > Projects**.
2. Select your project.
3. Open the **Domains** tab.
4. Click **Add Domain**.
5. Choose an existing Pxxl domain or enter an external domain.
6. Save, then click **Resync Proxy** on the domain if the route needs to refresh.

## [From The Domain](https://pxxl.app/#from-the-domain)

1. Open **Dashboard > Domains**.
2. Select the domain.
3. Open **Settings** or **Subdomains**.
4. Pick the project that should receive traffic.
5. Save the connection.
6. Click **Resync Proxy**.

For subdomains, enter only the subdomain label when the UI asks for it. Use `api` for `api.example.com`.

[Domain shows 404\\ \\ Create or refresh the hostname route when DNS points to Pxxl but the proxy has no app route.](https://pxxl.app/docs/quick-fixes/domain-404) [DNS records are wrong or not resolving\\ \\ Point root domains and subdomains to Pxxl and remove conflicting records.](https://pxxl.app/docs/quick-fixes/dns-records)

### On this page

[From The Project](https://pxxl.app/#from-the-project) [From The Domain](https://pxxl.app/#from-the-domain)