# Source: https://pxxl.app/docs/dashboard/deploy-project

Dashboard

# Creating Projects

Create a Pxxl project from a connected GitHub repository, configure build/runtime settings, choose scaling options, and deploy.

Open **Dashboard > Deploy project** or **Projects > Add New > Deploy from GitHub** to create a project from a connected GitHub repository.

![Deploy project entry page](https://cdn.pxxl.app/docs/dashboard-screenshots/14-deploy-entry.png)

## [Choose A Repository](https://pxxl.app/#choose-a-repository)

The deploy page lists repositories available to the connected GitHub account. Use search when the list is long.

![Search repositories before importing](https://cdn.pxxl.app/docs/dashboard-screenshots/15-deploy-search-repository.png)

Click **Import** beside the repository you want. Pxxl opens the deployment configuration screen before anything is created.

If the app already exists on Vercel, Netlify, Render, or Railway and you want to bring over provider metadata or environment variables first, use [Importing Projects](https://pxxl.app/docs/dashboard/import-projects) instead.

![Deployment configuration screen](https://cdn.pxxl.app/docs/dashboard-screenshots/16-deploy-configure-project.png)

## [Project Setup Fields](https://pxxl.app/#project-setup-fields)

| Field | What it controls |
| --- | --- |
| **Project Domain** | The public Pxxl subdomain for the new project. Use a unique name. |
| **Domain suffix** | The Pxxl suffix, such as `.pxxl.pro`, that the project subdomain uses. |
| **Port Number** | The runtime port Pxxl routes traffic to inside the container. Your app should listen on this port or read `PORT`. |
| **GitHub Branch** | The branch used for the first deployment. |
| **Select Commit** | The exact commit Pxxl deploys first. |
| **Multiple Services** | Enables multiple directories/services from the same repository. |

When the required fields are valid, the project is ready to create.

![Ready to create a project](https://cdn.pxxl.app/docs/dashboard-screenshots/17-deploy-ready-to-create.png)

## [Environment Variables](https://pxxl.app/#environment-variables)

Open **Environment Variables** before creating the project when the app needs secrets, API URLs, database URLs, or feature flags.

![Deployment environment variables panel](https://cdn.pxxl.app/docs/dashboard-screenshots/deploy-environment-variables.png)

Use clear names and avoid putting secrets into public frontend variables unless your framework intentionally exposes them.

## [Additional Build Settings](https://pxxl.app/#additional-build-settings)

Open **Additional Build Settings** when auto-detection needs help.

![Additional build settings panel](https://cdn.pxxl.app/docs/dashboard-screenshots/deploy-additional-build-settings.png)

Use this area for framework-specific overrides such as install commands, build commands, start commands, root directory, requirements file, package manager, or runtime version.

## [Server And Scaling](https://pxxl.app/#server-and-scaling)

Open **Server and Scaling** when the default resources are not enough.

![Server and scaling panel](https://cdn.pxxl.app/docs/dashboard-screenshots/deploy-server-and-scaling.png)

Use this section to review memory, CPU, build server, and scaling choices before the project is created.

## [Advanced Options](https://pxxl.app/#advanced-options)

The lower part of the create screen includes advanced deployment behavior.

![Advanced deployment options](https://cdn.pxxl.app/docs/dashboard-screenshots/18-deploy-advanced-options.png)

Common options include:

| Option | Use it for |
| --- | --- |
| **Blue-green deployment** | Test a new version before switching production traffic. |
| **Auto scaling** | Prepare the project for resource scaling behavior. |
| **Project webhooks** | Connect deployment lifecycle events to external systems. |
| **Build cache** | Speed up rebuilds when dependencies do not change. |
| **Preview environments** | Support temporary environments for branch or pull-request work. |

## [Safe Create Pattern](https://pxxl.app/#safe-create-pattern)

1. Confirm repository, branch, and commit.
2. Confirm domain availability.
3. Confirm the runtime port.
4. Add environment variables.
5. Review build/start commands.
6. Review scaling and advanced options.
7. Click **Deploy Project** only after the settings match the app.

[Dashboard Overview\\ \\ Understand the Pxxl dashboard layout, navigation, workspace switcher, and the main account health widgets.](https://pxxl.app/docs/dashboard) [Managing Projects\\ \\ Use the Projects page and project detail tabs to inspect deployments, logs, variables, domains, monitoring, scaling, and settings.](https://pxxl.app/docs/dashboard/projects)

### On this page

[Choose A Repository](https://pxxl.app/#choose-a-repository) [Project Setup Fields](https://pxxl.app/#project-setup-fields) [Environment Variables](https://pxxl.app/#environment-variables) [Additional Build Settings](https://pxxl.app/#additional-build-settings) [Server And Scaling](https://pxxl.app/#server-and-scaling) [Advanced Options](https://pxxl.app/#advanced-options) [Safe Create Pattern](https://pxxl.app/#safe-create-pattern)