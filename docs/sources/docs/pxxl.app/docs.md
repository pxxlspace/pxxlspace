# Source: https://pxxl.app/docs

# Pxxl Documentation

Deploy applications, manage custom domains, upload CDN assets, orchestrate databases, and monitor dashboard usage.

Pxxl is a modern, unified application deployment and infrastructure platform. It enables development teams to ship web applications, API services, and static sites from GitHub repositories to production servers without manual server configuration. The platform integrates custom domain routing, SSL certificate management, global CDN storage, managed databases, webhooks, and usage analytics into a single developer control plane.

This documentation serves three primary roles:

- **Application Developers:** Guides on creating projects, importing projects from other platforms, configuring framework settings, managing environment variables, and inspecting deployment logs.
- **Operations & Infrastructure Teams:** Guides on configuring custom domains, managing databases, scheduling cron jobs, and monitoring edge proxy logs.
- **API & Automation Builders:** Guides on API keys, OAuth integrations, webhook delivery, and backend-safe automation.

---

## [Dashboard Structure](https://pxxl.app/#dashboard-structure)

The dashboard contains distinct workspaces designed for project management and infrastructure orchestration:

| Tab Name | Purpose and Capabilities |
| --- | --- |
| **Overview** | A centralized view displaying active projects, domain count, database count, build-minute usage, recent deploys, and resource signals. |
| **Projects** | Management interface for individual services. Contains configuration tabs for deployment history, custom domains, environment variables, live runtime logs, and repository sync. |
| **Deploy** | Onboarding interface for new projects. Provides options to link GitHub repositories, import starter templates, or upload static folders, with framework detection overrides. |
| **Deployments** | A global history of all deployment tasks across all projects, showing detailed build outputs, status codes, and git commit origins. |
| **Domains** | Interface for reviewing domains, DNS records, subdomains, nameservers, SSL, and routing settings. |
| **CDN** | Object storage panel. Allows creating private or public storage spaces, uploading static files, inspecting usage metrics, and checking edge routing rule limits. |
| **API Keys** | Management page for generating scoped tokens for backend automation, CDN workflows, deployment checks, and monitoring. |
| **Database** | Database orchestration interface. Allows users to spin up managed instances of PostgreSQL, MySQL, and MongoDB, and link them to projects for automated metadata sync. |
| **Cron Jobs** | Task scheduler. Allows configuring recurring HTTP requests against project endpoints using standard cron syntax, complete with retry and execution histories. |

For screenshot-led dashboard workflows, start with the [Dashboard docs section](https://pxxl.app/docs/dashboard), then continue to [Creating Projects](https://pxxl.app/docs/dashboard/deploy-project), [Managing Projects](https://pxxl.app/docs/dashboard/projects), or [Importing Projects](https://pxxl.app/docs/dashboard/import-projects).

---

## [Core Workflow](https://pxxl.app/#core-workflow)

To take an application from a repository to a live custom domain on Pxxl, follow this workflow:

1. **Repository Connection:** Link your GitHub account and select a repository.
2. **Stack Verification:** Pxxl scans the repository to detect languages, frameworks, lockfiles, and commands. You can override these variables as needed.
3. **Initial Build:** Pxxl compiles your code, packages it, and deploys it on a secure runtime environment.
4. **Domain Routing:** Bind a Pxxl-managed domain or map an external domain by configuring the required DNS records (A, CNAME, or TXT).
5. **Data & Environment Setup:** Configure project environment variables, link databases, and establish cron jobs.
6. **Edge Verification:** Verify routing and security policies through the edge proxy metrics and access logs.

[Dashboard Overview\\ \\ Understand the Pxxl dashboard layout, navigation, workspace switcher, and the main account health widgets.](https://pxxl.app/docs/dashboard)

### On this page

[Dashboard Structure](https://pxxl.app/#dashboard-structure) [Core Workflow](https://pxxl.app/#core-workflow)