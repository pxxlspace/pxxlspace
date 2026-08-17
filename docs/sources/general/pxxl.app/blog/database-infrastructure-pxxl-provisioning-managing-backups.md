# Source: https://pxxl.app/blog/database-infrastructure-pxxl-provisioning-managing-backups

[Back to Blog](https://pxxl.app/blog)

Your application's database is the most important part of your infrastructure. Everything else can be rebuilt from source code and configuration. The database holds the state that your application accumulated over its lifetime: user accounts, content, transactions, product data, and everything else your application produces. Losing it, or losing access to it at the wrong moment, is the kind of incident that can end a product. This guide covers how database infrastructure works on Pxxl from provisioning through backup and recovery.

## Provisioning a database

Creating a database on Pxxl starts in the Databases section of the dashboard. Select the engine type, currently PostgreSQL or MySQL, and give the database a name that will help you identify it in the list. The platform provisions the database in the managed backend, configures network access, and returns a connection string, host, port, database name, username, and password within a short time.

These credentials are shown in the database settings panel and can be copied from there. They are stored encrypted in Pxxl's backend. The connection string is the easiest format to use with most ORMs and database client libraries. For frameworks like Prisma, the connection string can be pasted directly into the DATABASE\_URL environment variable and the ORM will parse it automatically. For lower-level clients, the individual host, port, database name, username, and password fields are also available.

After creating the database, go to your project settings and add the connection string as an environment variable. Redeploy the project after adding it so the build picks up the new variable. If your application runs migrations at startup, they will execute against the provisioned database on the next deployment. Make sure your migration strategy is idempotent. A migration that fails safely when re-run causes less trouble than one that tries to create a table that already exists and crashes the application startup.

## Connecting and verifying the connection

Database connection issues at deployment time usually fall into a few categories. The most common is a missing or incorrectly formatted connection string environment variable. Verify the variable name matches exactly what your application code expects. Connection strings are case-sensitive and whitespace matters. A trailing space copied accidentally from the dashboard into the environment variable field is enough to break the connection.

The second common issue is that the application tries to connect before the database is ready during the first provision. This is usually a brief window. If your application has retry logic on startup, it will handle this automatically. If it does not, a brief wait and redeploy is usually sufficient. The third category covers connection pool exhaustion. Each database instance has a maximum connection limit. If your application creates too many connections without releasing them, you will hit this limit. Use a connection pool and configure its maximum size to stay well below the database limit.

## Inspecting your database from the dashboard

Pxxl's database panel gives you visibility into the database's current state without needing a local database client connected over a public network. You can view the list of tables in the database and, for each table, the column names and data types. This is useful for quickly verifying that migrations ran correctly, checking that a table structure matches what you expect, and getting a fast read on the database schema without a context switch to an external tool.

Database logs are also accessible from the dashboard. These are the query logs and error logs from the database engine. For debugging a query problem or an unexpected error in your application, the database logs often contain the actual error message from the engine rather than the abstracted version your application's ORM or client provides. When your application logs show a vague database error, check the database logs for the underlying cause.

Database statistics including connection count, query throughput, and resource usage give you a baseline for understanding normal operating ranges. When something goes wrong, these metrics help you distinguish between an application bug, a resource exhaustion problem, and an infrastructure issue.

## Changing credentials and access control

If you need to rotate database credentials, the Change Password option in the database settings panel lets you set a new password for the database user. After changing the password, you must update the environment variable in every project that connects to the database and redeploy those projects. Until the environment variable is updated and the project is redeployed, connections using the old password will fail. Plan credential rotations during low-traffic periods and stage the rollout carefully if you have multiple projects or services connecting to the same database.

## Setting up automated backups

No database running production data should operate without a backup schedule. On Pxxl, database backup configuration is available from the database settings panel. You can set up a backup configuration with a schedule (daily, weekly, or monthly), a label for the backup set, and a retention policy. The platform generates the appropriate backup command for the database engine type and stores the backup configuration.

Backups run according to the schedule and store the output as encrypted archives. The encryption key for backup archives is tied to your user account. You can generate an encryption key from the account settings. This key is used to encrypt backup files before they are stored and must be provided when you want to retrieve and decrypt a backup. Store your encryption key securely outside of Pxxl. If you lose the key and need to recover a backup, the encrypted archive cannot be decrypted without it.

The backup archive format depends on the database engine. PostgreSQL backups use pg\_dump in custom format. MySQL backups use mysqldump. Both formats produce archives that can be restored with the standard restore commands for each engine. The platform stores the backup command alongside the backup configuration so you always have a record of exactly how the backup was produced, which matters when you need to restore from it.

## Manual backups and on-demand snapshots

In addition to scheduled backups, you can trigger a manual backup at any time from the backup configuration panel. This is useful before a major migration, a significant data import, a deployment that changes the database schema, or any operation that might affect data integrity. Trigger a manual backup, verify it completes successfully, then proceed with the potentially risky operation. If anything goes wrong, you have a clean snapshot to restore from.

Manual backups follow the same encryption and storage process as scheduled backups. They show up in the backup records list alongside scheduled backups with a label indicating they were created on demand. Each backup record includes the creation date, the size of the archive, and the backup identifier needed for retrieval and decryption.

## Retrieving and restoring a backup

To restore from a backup, retrieve the backup archive using the backup record identifier, decrypt it using your encryption key, and run the appropriate restore command against the target database. The platform provides the decryption tooling. The restore itself is run by you against the database, which gives you full control over where the data goes. You can restore to the original database, to a different database on Pxxl, or to a local database for debugging.

For PostgreSQL, restoration uses pg\_restore. For MySQL, it uses mysql with the dump file as input. Both commands accept the connection parameters from the database settings panel. The exact commands are documented in the backup configuration panel for each backup set so you do not need to construct them from memory during what is likely a stressful incident response situation.

## Database best practices for production applications

A few principles worth committing to before your application goes live. Run migrations idempotently so that re-deployments cannot break a running application. Use connection pooling and set conservative pool sizes relative to the database connection limit. Index columns that appear in WHERE clauses and JOIN conditions, especially on large tables where full scans become expensive. Set up backup schedules before the first real user data is written. Store your encryption key in a secure location that is independent of Pxxl, such as a password manager or a secrets management service. Test your backup and restore process before you need it. The worst time to discover that your backup process is broken is during an incident. Verify at least once that you can decrypt a backup and restore it to a test database successfully.