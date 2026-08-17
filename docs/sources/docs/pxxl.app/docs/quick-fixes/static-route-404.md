# Source: https://pxxl.app/docs/quick-fixes/static-route-404

Quick Fixes

# Static site route returns 404

Fix nested route behavior for plain HTML sites and SPA builds.

Static site route returns 404

Share this fix or copy it as Markdown for an LLM.

Share linkCopy as Markdown

If a static app works at `/` but fails at nested paths such as `/blog` or `/dashboard`, check whether the project is a plain HTML site or an SPA.

## [Choose The Right Mode](https://pxxl.app/#choose-the-right-mode)

- Plain HTML sites should contain real files such as `blog/index.html`.
- SPA builds such as React Vite usually need a fallback to `index.html`.
- Make sure the project was detected as the correct framework before deployment.

## [Redeploy](https://pxxl.app/#redeploy)

Redeploy after changing the framework or build output settings.

[Changed a project port\\ \\ Keep the project port, container labels, and proxy route aligned.](https://pxxl.app/docs/quick-fixes/project-port) [Build artifact expired\\ \\ Understand artifact retention when rollback cannot recreate an old deployment image.](https://pxxl.app/docs/quick-fixes/artifact-expired)

### On this page

[Choose The Right Mode](https://pxxl.app/#choose-the-right-mode) [Redeploy](https://pxxl.app/#redeploy)