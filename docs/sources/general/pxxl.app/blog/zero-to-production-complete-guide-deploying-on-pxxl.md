# Source: https://pxxl.app/blog/zero-to-production-complete-guide-deploying-on-pxxl

[Back to Blog](https://pxxl.app/blog)

There is a version of deploying your first application that is fast, clean, and leaves you with a live URL within minutes. There is also a version where you spend half a day fighting configuration, broken builds, DNS that takes forever to propagate, and SSL errors that do not explain themselves. This guide is meant to give you the first version. It walks through the complete process of going from a local repository to a production deployment on Pxxl, with enough detail that you understand what is happening at each step, not just what button to click.

## Before you start: what Pxxl needs from your repository

Pxxl builds your application from source. That means your repository should contain everything the platform needs to install dependencies and produce a runnable output. For most JavaScript and TypeScript projects this means a package.json at the root or in the framework's expected location, a clearly defined build command, and a start command if you are running a server. For static sites, you need a defined output directory. For Python applications, a requirements.txt or pyproject.toml. For PHP, the entry file should be reachable from the configured public path.

You do not need to commit build artifacts. Pxxl installs dependencies and runs your build command fresh on each deployment. Keep your .gitignore clean and do not commit node\_modules, .env files, or build output directories. The platform manages all of that during the build process.

## Creating a project and connecting your repository

After logging into Pxxl, go to your dashboard and click New Project. You will be prompted to connect your GitHub account if you have not already done so. Once connected, you can search for the repository you want to deploy. Select it, then choose the branch that should be the production branch for this project. This branch is the one that Pxxl will watch for push events. Pushes to other branches will not trigger production builds unless you configure additional rules.

Once you select the branch, Pxxl analyzes the repository and detects the framework, package manager, and common commands. For a Next.js project it will typically detect npm or pnpm, set the install command to the appropriate install invocation, and set the build command to next build. For a Vite project it will detect the build command from the scripts in package.json. Review these detected settings carefully before clicking Deploy. If anything looks wrong, edit it now. You can change these settings later, but getting them right the first time saves you a failed build.

## Setting environment variables before the first deploy

Most applications need environment variables: API keys, database connection strings, third-party service tokens, and configuration values that differ between development and production. On Pxxl you add these in the project settings under Environment Variables before triggering the first deploy. Variables you add here are injected into both the build process and the runtime environment.

A few practices that will save you trouble later: name your variables consistently with what your code expects; do not assume that values from a .env.local file in your repository will be picked up automatically by the platform; and if you have build-time variables that get baked into static assets (like NEXT\_PUBLIC\_ prefixed variables in Next.js), make sure they are defined before the build runs, not just at runtime.

Sensitive values like secret keys and database passwords are stored encrypted in Pxxl's environment store. They are never exposed in build logs or deployment output. If a sensitive value does appear in your build log, that means your application code is printing it, which is a problem in your application rather than the platform.

## Running the first build and reading the logs

Click Deploy. Pxxl queues the build, provisions a build container, clones the repository, runs the install command, runs the build command, and then either deploys the result or marks the build as failed. The entire process is logged in real time in the Deployments panel of your project. Open the log for the current deployment and watch it run.

If the build fails, the log will show you the exact command that failed and the output it produced. Common causes at this stage are missing environment variables that the application expects during build, a package that cannot be installed due to a version conflict, a TypeScript error that your local setup was tolerating but the platform's stricter environment is not, or a build command that expects a tool to be globally installed. Read the error message before trying anything else. The platform logs are not noisy; when something fails, the relevant error is usually in the last few lines of the log.

## Attaching a custom domain

After a successful first deployment, your project gets a Pxxl subdomain you can use immediately. When you are ready to use your own domain, go to the Domains section of your project. You can either attach a domain you already own from an external registrar or register a new domain through Pxxl.

For an external domain, you add the domain name in the dashboard and then add a CNAME record at your current DNS provider pointing to the value Pxxl gives you. DNS propagation is usually fast but can take up to a few hours depending on the TTL settings at your current provider. You can speed this up by lowering the TTL before you start the migration. Once Pxxl detects the CNAME, it issues an SSL certificate automatically and marks the domain as verified.

For a domain registered through Pxxl, the process is simpler. The platform sets up the DNS zone, creates the necessary records, and attaches the domain to your project in one flow. You do not need to log into a separate registrar or DNS panel.

## Adding a database

If your application needs a database, go to the Databases section in the left sidebar. Create a new database, choose the engine (PostgreSQL or MySQL), give it a name, and let the platform provision it. Within a short time you will have a connection string, host, port, database name, username, and password available in the database settings panel.

Copy the connection string and add it to your project as an environment variable. Redeploy the project after adding the variable so the new build picks it up. Your application should now be able to connect to the database. If you run migrations at startup or as part of the build process, they will run against the provisioned database using the credentials you set. Make sure your migration commands are idempotent so that re-deployments do not cause problems if a migration has already been applied.

## Going live: a pre-launch checklist

Before announcing your deployment to the world, work through this list. Confirm that your custom domain resolves correctly in a browser and shows a valid SSL certificate. Check the production build output for any console errors or failed network requests. Verify that all environment variables are in place by testing the application's key flows, especially anything that involves external API calls or database queries. Confirm that your application handles 404 routes gracefully rather than crashing. Test the application on a mobile device or at a simulated slower network speed. Check that your page title, meta description, and Open Graph image are set correctly for the main routes.

After launch, check back on your deployment logs and application logs over the first 24 hours. The first real traffic often surfaces edge cases that local testing misses. Pxxl keeps build logs and, for server-side applications, runtime logs accessible from the dashboard so you can investigate without needing external log tooling during the early stages.

## Keeping the deployment healthy over time

Production applications need maintenance beyond the initial launch. Set up database backups from the Databases section and choose a backup frequency appropriate to how often your data changes. Review your CDN usage if you are serving user-uploaded content or large media files. Keep an eye on the build time for your project and optimize your install and build commands if builds are getting slow, for example by checking whether you are installing unnecessary dev dependencies in production.

When you need to push an update, commit and push to the linked branch. Pxxl builds and deploys automatically. If the new deployment causes a regression, go to the Deployments panel, find the last successful deployment, and click to redeploy it. The rollback takes effect within seconds and gives you time to investigate the problem in the new build without impacting users.