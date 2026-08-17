# Source: https://pxxl.app/blog/migrating-production-app-to-pxxl-from-vercel-render-railway-heroku

[Back to Blog](https://pxxl.app/blog)

Production migrations are not just technical events. They are risk management exercises. The application is live, users are depending on it, and anything that interrupts availability has a real cost. The technical work of moving an application from one platform to another is usually straightforward. The risk management around that work, specifically keeping the current deployment running until the new one is verified, coordinating the DNS cutover, handling database migration, and having a rollback plan, is where migrations succeed or fail.

This guide is written for teams moving a running production application to Pxxl. It covers each phase of the migration in sequence, explains where the risk is in each phase, and describes how to reduce that risk to an acceptable level. The application types covered include static sites, single-page applications, Next.js and full-stack server-side applications, Node.js and Python APIs, and applications with managed databases.

## Phase 1: Prepare the Pxxl account and project

Create a Pxxl account before touching the current deployment. Connect your GitHub account. Create a new project for the application and select the same branch that is currently deployed on your existing platform. Review the detected build configuration. For most frameworks, Pxxl will detect the framework and suggest the correct install and build commands. Override these if your application has a custom build setup, build-time environment variables, or a non-standard output directory.

Add all environment variables that the application uses in production. Do this before the first build. Missing environment variables at build time can cause the build to fail or produce an incorrect build artifact. Missing environment variables at runtime can cause the application to start but fail when it reaches code that uses the missing variable. Get a complete list of environment variables from your current platform's settings and add them all to the Pxxl project before deploying.

Trigger the first build and let it complete. Read the build log carefully even if the build succeeds. Build warnings that you have been ignoring on the current platform may be more visible here. Verify that the build output looks correct. Test the deployment on the Pxxl subdomain before making any DNS changes. The Pxxl subdomain is live immediately after deployment and can be tested fully without affecting the current production domain.

## Phase 2: Verify the new deployment thoroughly

Testing on the Pxxl subdomain should cover everything you would test before any production deployment. Go through every major user flow in the application. Test authentication, including login, signup, session persistence, and logout. Test any payment flows using test credentials. Test file uploads if the application handles them. Test any real-time features including WebSocket connections. Check that all external API integrations are functioning using the production environment variables you configured.

If the application uses server-side rendering or any server-side data fetching, verify that these work correctly from the Pxxl subdomain. Some server-side features depend on the domain name in the request and may behave differently when called from a different domain. Identify any such dependencies now rather than after the DNS cutover when users are affected.

Check the browser developer console for errors. A successful deployment does not mean an error-free deployment. Console errors during normal application use indicate problems that will affect users. Fix these before proceeding with the DNS cutover.

## Phase 3: Database migration for applications with managed databases

Database migration is the highest-risk phase of any platform migration. The database contains state that cannot be recreated from source code. Mistakes here can result in data loss that is difficult or impossible to recover from without a backup.

Take a complete backup of the current database before starting. Store this backup in a location independent of both the current platform and Pxxl. If anything goes wrong during migration, this backup is your recovery point. Verify that the backup is complete and that you know how to restore from it before proceeding.

Create the target database on Pxxl from the Databases section. Use the connection string from the Pxxl dashboard to connect a database migration tool to the new database. For most PostgreSQL databases, pg\_dump and pg\_restore are the appropriate tools. For MySQL, mysqldump and mysql. Run a full dump of the current database and restore it to the Pxxl database. Verify the row counts in key tables match between source and target.

Update the Pxxl project environment variables to use the new database connection string. Redeploy the project and test all database-dependent functionality on the Pxxl subdomain against the migrated database. The window between taking the backup and completing the migration is a period during which new writes to the current database are not captured in the Pxxl database. Plan the DNS cutover to happen shortly after the migration completes to minimize this divergence window. For applications where any data loss is unacceptable, plan a maintenance window, take a final incremental backup after reducing traffic to the old deployment, apply the incremental changes to the new database, then cut over immediately.

## Phase 4: Domain transfer and DNS cutover strategy

The DNS cutover is the moment when traffic starts going to the new deployment. Before making any DNS changes, add your custom domain to the Pxxl project and complete the domain verification process. For a domain at an external registrar, add the verification CNAME record to your current DNS provider and wait for Pxxl to confirm verification. This step can take a few minutes. Do not start the cutover until verification is confirmed and the SSL certificate has been issued.

Lower the TTL on the domain's A and CNAME records at your current DNS provider well before the cutover, ideally 24 to 48 hours in advance. DNS records are cached by resolvers for the duration specified by their TTL. If the current TTL is 24 hours (86400 seconds) and you change the records, some resolvers will continue using the old records for up to 24 hours after the change. Lowering the TTL to 60 to 300 seconds before the cutover means the transition completes much faster when you make the switch.

When you are ready to cut over, update the DNS records at your registrar or DNS provider to point to the values Pxxl specifies for the custom domain. With a low TTL, the new records will propagate within a few minutes. Monitor both the old deployment and the new one during this window. The old deployment should see traffic decrease as resolvers pick up the new records. The new deployment should see traffic increase correspondingly.

## Phase 5: Monitoring and validation after cutover

Keep the old deployment running for at least 24 hours after the DNS cutover. Some users will be resolved to the old deployment for longer than expected if their resolver cached the old records. Traffic to the old deployment should decline to near zero within a few hours if the TTL was properly reduced. If the old deployment continues to receive significant traffic long after the cutover, investigate whether there is a resolver that is not respecting the TTL or a hardcoded IP reference somewhere in the application.

Watch the Pxxl deployment logs and database logs during the first few hours after cutover. The first real production traffic often surfaces edge cases that testing did not cover. A request path that was never tested, a database query that performs poorly under real data volumes, or an external service integration that behaves differently for production users than for test users can all surface in this window.

Check application error rates in whatever error tracking you use. An increase in errors after cutover indicates a problem with the new deployment that was not visible during testing. If errors are coming from a specific function or route, check the relevant logs on both the application and database sides. The integrated dashboard on Pxxl keeps deployment logs, database logs, and database statistics in one place, which makes this kind of cross-layer investigation significantly faster than it would be across disconnected tools.

## Phase 6: Decommissioning the old deployment

Once the new deployment has been running in production for at least a week with no incidents attributable to the migration, you can begin decommissioning the old deployment. Before doing so, take a final check that all DNS records are pointing to Pxxl and that no external service is configured to call the old platform's domain. Export any logs or data from the old platform that you want to retain for compliance or debugging purposes. Cancel the subscription or delete the project on the old platform. The migration is complete.