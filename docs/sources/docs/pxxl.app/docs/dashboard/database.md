# Source: https://pxxl.app/docs/dashboard/database

Dashboard

# Database

Create managed databases from the dashboard, link them to projects, and expose the right connection values to your running containers.

Use **Dashboard > Database** when your project needs a managed PostgreSQL, MySQL, or MongoDB service. Databases are created as workspace resources first, then linked to the project or container that needs them.

![Database page](https://cdn.pxxl.app/docs/dashboard-screenshots/04-database.png)

## [Create A Database](https://pxxl.app/#create-a-database)

1. Open **Dashboard > Database**.
2. Click **Create Database**.
3. Choose the engine type: PostgreSQL, MySQL, or MongoDB.
4. Select the owning project or workspace scope.
5. Confirm the name, region, and resource settings.
6. Create the database and wait for the status to become active.

When provisioning finishes, open the database detail page and copy the connection URL, username, password, host, port, and database name your app expects.

## [Link A Database To A Project](https://pxxl.app/#link-a-database-to-a-project)

You can attach an existing database from the project architecture view.

![Project overview and architecture view](https://cdn.pxxl.app/docs/dashboard-screenshots/19-project-overview.png)

1. Open **Dashboard > Projects**.
2. Select the project that should use the database.
3. Open the architecture or project overview area.
4. Choose the database service action.
5. Select **Existing database**.
6. Pick the database from the dropdown and confirm.

After linking, the database appears in the project architecture so you can see which app container depends on it.

## [Add Connection Values To The Container](https://pxxl.app/#add-connection-values-to-the-container)

Linking the resource records the relationship. Your application still needs environment variables to connect at runtime.

![Project environment variables tab](https://cdn.pxxl.app/docs/dashboard-screenshots/22-project-environment-variables.png)

1. Open the project **Environment Variables** tab.
2. Add the variables your framework expects, such as `DATABASE_URL`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`.
3. Use the external database URL shown in the database detail page when your runtime container connects over the public database endpoint.
4. Save the variables.
5. Redeploy the project so the new container starts with the updated environment.

## [PostgreSQL Example](https://pxxl.app/#postgresql-example)

```
DATABASE_URL=postgres://user:password@db.pxxl.pro:5432/app
PGHOST=db.pxxl.pro
PGPORT=5432
PGDATABASE=app
PGUSER=user
PGPASSWORD=password
```

## [MySQL Example](https://pxxl.app/#mysql-example)

```
DATABASE_URL=mysql://user:password@db.pxxl.pro:3306/app
MYSQL_HOST=db.pxxl.pro
MYSQL_PORT=3306
MYSQL_DATABASE=app
MYSQL_USER=user
MYSQL_PASSWORD=password
```

## [Container Checklist](https://pxxl.app/#container-checklist)

| Check | Why it matters |
| --- | --- |
| **Runtime envs are saved** | Containers only receive database credentials through environment variables. |
| **The app reads `DATABASE_URL` or matching DB vars** | Hardcoded local values will fail after deployment. |
| **The database is active** | Pending databases may not accept connections yet. |
| **The project was redeployed** | Existing containers do not automatically reload new environment values. |
| **Migrations are safe** | Run migrations idempotently so redeploys do not corrupt data. |

## [Cron Jobs](https://pxxl.app/#cron-jobs)

Use **Dashboard > Cron Job** for scheduled HTTP tasks that hit an endpoint in your app, such as nightly cleanup, report generation, or recurring sync jobs.

![Cron jobs page](https://cdn.pxxl.app/docs/dashboard-screenshots/08-cronjobs.png)

Keep cron endpoints idempotent. Pxxl may retry requests after network or runtime failures, so the target endpoint should safely handle repeated calls.

[Manage Domains\\ \\ Search domains, open a domain detail page, manage DNS, subdomains, nameservers, SSL, and settings using robinsonhonour.cv as an example.](https://pxxl.app/docs/dashboard/domains) [Settings, Usage, And Webhooks\\ \\ Use dashboard settings tabs, usage reports, invoices, notifications, customization, and signed webhooks.](https://pxxl.app/docs/dashboard/settings-usage-webhooks)

### On this page

[Create A Database](https://pxxl.app/#create-a-database) [Link A Database To A Project](https://pxxl.app/#link-a-database-to-a-project) [Add Connection Values To The Container](https://pxxl.app/#add-connection-values-to-the-container) [PostgreSQL Example](https://pxxl.app/#postgresql-example) [MySQL Example](https://pxxl.app/#mysql-example) [Container Checklist](https://pxxl.app/#container-checklist) [Cron Jobs](https://pxxl.app/#cron-jobs)