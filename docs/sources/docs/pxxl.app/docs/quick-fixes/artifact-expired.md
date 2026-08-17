# Source: https://pxxl.app/docs/quick-fixes/artifact-expired

Quick Fixes

# Build artifact expired

Understand artifact retention when rollback cannot recreate an old deployment image.

Build artifact expired

Share this fix or copy it as Markdown for an LLM.

Share linkCopy as Markdown

Build artifacts are kept according to your plan retention window. If the artifact expired, the deployment history remains, but rollback cannot recreate the image from that old artifact.

## [Fix Options](https://pxxl.app/#fix-options)

- Redeploy the same commit.
- Upgrade to a plan with longer artifact retention.
- Keep critical release tags in Git so the exact version can be deployed again.

[Static site route returns 404\\ \\ Fix nested route behavior for plain HTML sites and SPA builds.](https://pxxl.app/docs/quick-fixes/static-route-404) [Database is not visible inside a project\\ \\ Attach a database as a sub service and pass its connection URL into the project environment.](https://pxxl.app/docs/quick-fixes/database-not-visible)

### On this page

[Fix Options](https://pxxl.app/#fix-options)