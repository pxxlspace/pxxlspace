# Source: https://pxxl.app/docs/dashboard/projects

Dashboard

# Managing Projects

Use the Projects page and project detail tabs to inspect deployments, logs, variables, domains, monitoring, scaling, and settings.

Open **Dashboard > Projects** to browse every project in the current workspace.

![Projects list](https://cdn.pxxl.app/docs/dashboard-screenshots/02-projects-list.png)

## [Project Cards](https://pxxl.app/#project-cards)

Each project card gives a compact view of the app:

| Area | Meaning |
| --- | --- |
| **Screenshot** | Current preview image for the app. |
| **Project name** | The internal Pxxl project name. |
| **Framework and repository** | Detected stack and linked GitHub source. |
| **Domain count** | Number of domains attached to the project. |
| **Primary domain** | The main public URL shown on the card. |
| **Latest commit/status text** | Recent deployment context. |
| **Last activity** | How recently the project changed. |

Select a card to open the project workspace.

![Project overview workspace](https://cdn.pxxl.app/docs/dashboard-screenshots/19-project-overview.png)

## [Project Tabs](https://pxxl.app/#project-tabs)

| Tab | Use it for |
| --- | --- |
| **Overview** | Architecture canvas, connected services, sticky notes, domains, and quick context. |
| **Deployments** | Build/deploy history for this project. |
| **Live Logs** | Runtime logs from the running service. |
| **Environment Variables** | Global and project-scoped variables. |
| **Issues** | Linked issues and project notes. |
| **Domains** | Project-level domain routing and connection state. |
| **Monitoring** | Runtime and traffic health. |
| **Infra & Scaling** | Compute resources, memory, CPU, and scaling controls. |
| **Settings** | Repository, build, protection, GitHub, and danger-zone settings. |

## [Deployments](https://pxxl.app/#deployments)

![Project deployments tab](https://cdn.pxxl.app/docs/dashboard-screenshots/20-project-deployments.png)

Use **Deployments** to inspect build history, status, commit metadata, and previous deploy attempts. Open this tab first when an app is not serving the expected version.

## [Live Logs](https://pxxl.app/#live-logs)

![Project live logs tab](https://cdn.pxxl.app/docs/dashboard-screenshots/21-project-live-logs.png)

Use **Live Logs** to inspect runtime output after deployment. This is where you check app startup errors, failed requests, and framework logs.

## [Environment Variables](https://pxxl.app/#environment-variables)

![Project environment variables tab](https://cdn.pxxl.app/docs/dashboard-screenshots/22-project-environment-variables.png)

Use **Environment Variables** for secrets, database URLs, API credentials, and runtime configuration. Separate global workspace variables from variables that apply only to the selected project.

## [Issues](https://pxxl.app/#issues)

![Project issues tab](https://cdn.pxxl.app/docs/dashboard-screenshots/23-project-issues.png)

Use **Issues** to track project problems and handoff notes. This is useful for connecting infrastructure problems with product work.

## [Domains](https://pxxl.app/#domains)

![Project domains tab](https://cdn.pxxl.app/docs/dashboard-screenshots/24-project-domains.png)

Use **Domains** to see which hostnames route to the project. For deeper DNS, SSL, and nameserver controls, open **Dashboard > Domain** and select the domain.

## [Monitoring](https://pxxl.app/#monitoring)

![Project monitoring tab](https://cdn.pxxl.app/docs/dashboard-screenshots/25-project-monitoring.png)

Use **Monitoring** to check runtime health, traffic, and errors. Review this tab after deploys, domain changes, and scaling updates.

## [Infra And Scaling](https://pxxl.app/#infra-and-scaling)

![Project infra and scaling tab](https://cdn.pxxl.app/docs/dashboard-screenshots/26-project-infra-scaling.png)

Use **Infra & Scaling** when the app needs more resources or persistent infrastructure controls.

## [Settings](https://pxxl.app/#settings)

![Project settings tab](https://cdn.pxxl.app/docs/dashboard-screenshots/27-project-settings.png)

Use **Settings** for repository connection details, build behavior, GitHub automation, deployment protection, and destructive project actions.

[Creating Projects\\ \\ Create a Pxxl project from a connected GitHub repository, configure build/runtime settings, choose scaling options, and deploy.](https://pxxl.app/docs/dashboard/deploy-project) [Importing Projects\\ \\ Import existing Vercel, Netlify, Render, or Railway projects into Pxxl using provider access keys.](https://pxxl.app/docs/dashboard/import-projects)

### On this page

[Project Cards](https://pxxl.app/#project-cards) [Project Tabs](https://pxxl.app/#project-tabs) [Deployments](https://pxxl.app/#deployments) [Live Logs](https://pxxl.app/#live-logs) [Environment Variables](https://pxxl.app/#environment-variables) [Issues](https://pxxl.app/#issues) [Domains](https://pxxl.app/#domains) [Monitoring](https://pxxl.app/#monitoring) [Infra And Scaling](https://pxxl.app/#infra-and-scaling) [Settings](https://pxxl.app/#settings)