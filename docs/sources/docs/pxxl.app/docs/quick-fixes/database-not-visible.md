# Source: https://pxxl.app/docs/quick-fixes/database-not-visible

Quick Fixes

# Database is not visible inside a project

Attach a database as a sub service and pass its connection URL into the project environment.

Database is not visible inside a project

Share this fix or copy it as Markdown for an LLM.

Share linkCopy as Markdown

If you created a database but cannot select it from a project:

## [Attach The Database](https://pxxl.app/#attach-the-database)

1. Open **Dashboard > Database** and confirm the database is active.
2. Open the project overview or architecture view.
3. Add the existing database as a sub service.
4. Add the database URL to the project environment variables.
5. Redeploy the project so the runtime container receives the new environment.

## [Full Database Guide](https://pxxl.app/#full-database-guide)

For the complete flow, open [Dashboard database setup](https://pxxl.app/docs/dashboard/database).

[Build artifact expired\\ \\ Understand artifact retention when rollback cannot recreate an old deployment image.](https://pxxl.app/docs/quick-fixes/artifact-expired) [OAuth callback fails or returns to the wrong URL\\ \\ Match OAuth callback URLs, redirect URIs, HTTPS, and allowlists.](https://pxxl.app/docs/quick-fixes/oauth-callback)

### On this page

[Attach The Database](https://pxxl.app/#attach-the-database) [Full Database Guide](https://pxxl.app/#full-database-guide)