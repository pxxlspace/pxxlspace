# Source: https://pxxl.app/guide/how-to-automate-deployments-nigeria

How-to Guide6 min read2026-05-23

# How to Automate Your Deployments as a Nigerian Developer — CI/CD Guide

Manual deployments waste time and introduce errors. This guide shows Nigerian developers how to set up a fully automated deployment pipeline where every Git push triggers a build and deployment automatically.

## Setting Up Automatic Deployments from GitHub

When you connect a GitHub repository to Pxxl, automatic deployments are enabled by default. Every push to your main branch triggers a new build and deployment. Every push to a feature branch creates a preview deployment with a unique URL — perfect for sharing with Nigerian clients or teammates for review before merging to production. No additional configuration is needed — this CI/CD behaviour is built into Pxxl.

## Adding GitHub Actions for Tests Before Deployment

Create a .github/workflows/ci.yml file in your repository. Configure it to run your test suite on every push. In Pxxl's settings, you can configure deployment to only trigger when your GitHub Actions CI passes — this prevents broken code from deploying to production. Your workflow should run 'npm test' or 'pytest' before Pxxl picks up the commit for deployment.

## Managing Multiple Environments: Preview, Staging, Production

Configure three Pxxl projects for your application: one for production (connected to your 'main' branch), one for staging (connected to 'develop'), and one for preview deployments. Each environment gets its own environment variables — production uses the production database URL, staging uses a separate staging database. This prevents Nigerian developers from accidentally testing with production data or deploying untested code to production users.

### Ready to deploy on Pxxl?

Connect your GitHub repository and go live in under 30 seconds. No credit card required.

[Get started free](https://pxxl.app/signup)

ci/cdnigeriagithub actionsautomation

## Related guides

[How-to Guide\\ \\ **How to Deploy a Next.js App in Nigeria — Free Hosting in 5 Minutes**\\ \\ Deploy your Next.js application for free in Nigeria. This guide covers connecting GitHub to Pxxl, environment variables, custom domains, and SSR deployment.](https://pxxl.app/guide/how-to-deploy-nextjs-nigeria) [How-to Guide\\ \\ **How to Deploy a Node.js App for Free in Nigeria — Complete Guide**\\ \\ Deploy Node.js apps (Express, NestJS, Fastify) for free in Nigeria. This guide covers Git deployment, environment variables, and keeping your app always online.](https://pxxl.app/guide/how-to-deploy-nodejs-app-nigeria) [How-to Guide\\ \\ **How to Deploy a Full-Stack App in Nigeria — Frontend + Backend + Database**\\ \\ Deploy a complete full-stack app in Nigeria with a React frontend, Node.js or Python backend, and PostgreSQL database — all on one platform.](https://pxxl.app/guide/how-to-deploy-fullstack-app-nigeria)