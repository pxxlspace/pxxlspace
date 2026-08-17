# Source: https://pxxl.app/docs/dashboard/import-projects

Dashboard

# Importing Projects

Import existing Vercel, Netlify, Render, or Railway projects into Pxxl using provider access keys.

Use project import when an app already exists on another hosting platform and you want Pxxl to read its project metadata, repository connection, build commands, and available environment variables before creating the Pxxl project.

Open **Dashboard > Projects > Add New > Import Project**. You can also open **Dashboard > Deploy project** and choose the import option when it is available.

![Import projects provider access step](https://cdn.pxxl.app/docs/dashboard-screenshots/import-projects-provider-access-v2.png)

## [Import Flow](https://pxxl.app/#import-flow)

| Step | What happens |
| --- | --- |
| **Provider access** | Choose Vercel, Netlify, Render, or Railway, paste the provider key, decide whether to save it encrypted, then fetch projects. |
| **Select project** | Search the provider projects and choose the app or service you want to move into Pxxl. |
| **Confirm create** | Review the project name, branch, port, domain option, commands, and environment variables before creating the Pxxl project. |

Imported projects still create normal Pxxl projects. After creation, manage them from [Managing Projects](https://pxxl.app/docs/dashboard/projects) just like projects created directly from GitHub.

## [Step 1: Provider Access](https://pxxl.app/#step-1-provider-access)

The first panel asks for the provider and an access key. Open the provider dropdown to choose between Vercel, Render, Railway, and Netlify.

![Import projects provider dropdown showing Vercel, Render, Railway, and Netlify](https://cdn.pxxl.app/docs/dashboard-screenshots/import-projects-provider-picker-v2.png)

| Control | What to do |
| --- | --- |
| **Provider** | Select the platform that currently hosts the project. |
| **Token / API key** | Paste the provider key. Pxxl uses it to list projects and read import metadata. |
| **Save encrypted key** | Keep this enabled if you want Pxxl to reuse the key for future imports. Disable it for a one-time import. |
| **How to get this key** | Opens the provider's own key page so you can create or copy a key. |
| **Fetch projects** | Calls the provider and moves to the project selection step when projects are available. |

Use short-lived tokens when the provider supports expiration. If you only need the token for one migration, revoke it in the provider dashboard after the import succeeds.

## [Provider Key Guides](https://pxxl.app/#provider-key-guides)

### [Netlify](https://pxxl.app/#netlify)

![Netlify selected in the Pxxl import provider form](https://cdn.pxxl.app/docs/dashboard-screenshots/import-projects-netlify-provider-v2.png)

1. Open **Netlify > User settings > Applications**.
2. Scroll to **Personal access tokens**.
3. Click **New access token**.
4. Give the token a clear name, such as `Pxxl import`.
5. Choose a short expiration when possible.
6. Create the token and copy it once.
7. Paste it into Pxxl, keep **Save encrypted key** enabled only if you want future Netlify imports, then click **Fetch projects**.

Netlify tokens are useful for importing sites, repository metadata, build settings, and build environment values that Netlify exposes through its API.

### [Vercel](https://pxxl.app/#vercel)

1. Open **Vercel > Account Settings > Tokens**.
2. Enter a token name, such as `Pxxl import`.
3. Select the team or personal account that owns the project.
4. Choose an expiration.
5. Create the token and copy it once.
6. Paste it into Pxxl and fetch projects.

Choose the same Vercel scope that owns the project. If the project belongs to a team, a personal-only token may not return it.

### [Render](https://pxxl.app/#render)

1. Open **Render > Account settings > API Keys**.
2. Click **Create API Key**.
3. Name the key for the migration.
4. Create the key and copy it once.
5. Paste it into Pxxl and fetch projects.

Render imports are service-oriented. After fetching, select the service that maps to the application you want Pxxl to create.

### [Railway](https://pxxl.app/#railway)

1. Open **Railway > Account settings > Tokens**.
2. Create an account token for the workspace that owns the project.
3. Copy the token once.
4. Paste it into Pxxl and fetch projects.

Railway projects can contain multiple services. Pick the service that represents the web app or API you want Pxxl to deploy.

## [Step 2: Select Project](https://pxxl.app/#step-2-select-project)

After Pxxl fetches projects, use search to narrow the list. The project card can include the provider name, repository URL, framework, build command, install command, start command, and environment-variable summary.

Some provider projects may be hidden when Pxxl cannot match them to a GitHub owner or organization connected to the current workspace. If the app is missing:

1. Confirm the provider token belongs to the correct account or team.
2. Connect the matching GitHub owner or organization in Pxxl.
3. Return to **Import Project** and fetch projects again.

## [Step 3: Confirm Create](https://pxxl.app/#step-3-confirm-create)

Before creating the project, review the imported settings.

| Field | What to verify |
| --- | --- |
| **Project name** | This becomes the Pxxl project name and suggested subdomain. Use lowercase letters, numbers, and hyphens. |
| **Port** | The port your application listens on inside the runtime. Node apps commonly use `3000`, but apps should read `PORT` when possible. |
| **Domain option** | Choose whether Pxxl should create a Pxxl subdomain immediately. Custom domains can be added later from the project or domain pages. |
| **GitHub branch** | Select the branch Pxxl should deploy first. |
| **Commands** | Review install, build, and start commands. Override provider values if the app needs different commands on Pxxl. |
| **Environment variables** | Import available provider variables and add any missing values manually. |

Click **Create Pxxl project** only after the repository, branch, commands, port, and environment variables match the app.

## [Environment Variables During Import](https://pxxl.app/#environment-variables-during-import)

Providers do not always expose secret values after creation. When a provider only returns variable names or masked values, add the real values manually in the import form or after creation in **Project > Environment Variables**.

Recommended pattern:

1. Import non-secret metadata from the provider.
2. Add required secrets manually.
3. Deploy once.
4. Open **Project > Live Logs** if the app does not start.
5. Rotate or revoke the provider token if you used it only for migration.

## [After Import](https://pxxl.app/#after-import)

Once the Pxxl project exists:

| Next step | Where to go |
| --- | --- |
| Check build status | **Project > Deployments** |
| Watch runtime output | **Project > Live Logs** |
| Add or correct secrets | **Project > Environment Variables** |
| Attach a custom domain | **Project > Domains** or [Manage Domains](https://pxxl.app/docs/dashboard/domains) |
| Tune resources | **Project > Infra & Scaling** |
| Change repository or protection settings | **Project > Settings** |

## [Security Checklist](https://pxxl.app/#security-checklist)

1. Use provider tokens with the shortest practical expiration.
2. Save the key encrypted in Pxxl only when future imports are expected.
3. Never paste provider tokens into screenshots, chat messages, commits, or support tickets.
4. Revoke one-time migration tokens after the project imports successfully.
5. Rotate imported application secrets if they were exposed during migration.

[Managing Projects\\ \\ Use the Projects page and project detail tabs to inspect deployments, logs, variables, domains, monitoring, scaling, and settings.](https://pxxl.app/docs/dashboard/projects) [Manage Domains\\ \\ Search domains, open a domain detail page, manage DNS, subdomains, nameservers, SSL, and settings using robinsonhonour.cv as an example.](https://pxxl.app/docs/dashboard/domains)

### On this page

[Import Flow](https://pxxl.app/#import-flow) [Step 1: Provider Access](https://pxxl.app/#step-1-provider-access) [Provider Key Guides](https://pxxl.app/#provider-key-guides) [Netlify](https://pxxl.app/#netlify) [Vercel](https://pxxl.app/#vercel) [Render](https://pxxl.app/#render) [Railway](https://pxxl.app/#railway) [Step 2: Select Project](https://pxxl.app/#step-2-select-project) [Step 3: Confirm Create](https://pxxl.app/#step-3-confirm-create) [Environment Variables During Import](https://pxxl.app/#environment-variables-during-import) [After Import](https://pxxl.app/#after-import) [Security Checklist](https://pxxl.app/#security-checklist)