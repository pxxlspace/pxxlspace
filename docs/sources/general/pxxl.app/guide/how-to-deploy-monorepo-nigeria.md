# Source: https://pxxl.app/guide/how-to-deploy-monorepo-nigeria

How-to Guide7 min read2026-05-23

# How to Deploy a Monorepo App in Nigeria — Multiple Apps from One Repo

Monorepo architectures — where multiple apps and packages live in one repository — are increasingly popular among Nigerian development teams. Pxxl supports monorepos out of the box, letting you deploy each app independently from the same repository.

## What Is a Monorepo and When Should Nigerians Use One

A monorepo organises multiple related projects — a web app, admin dashboard, and backend API — in a single Git repository with shared packages (like a component library or utility functions). Nigerian teams building products with multiple surfaces benefit from monorepos because changes to shared code are immediately available to all apps, and a single 'git push' can trigger deployments across all services.

## Configuring Pxxl for Monorepo Deployments

For each app in your monorepo, create a separate Pxxl project. In each project's settings, set the 'Root Directory' to the subfolder of that specific app — for example, 'apps/web' for the frontend or 'apps/api' for the backend. Set the build and start commands relative to that root directory. Pxxl will only rebuild and deploy the specific app that changed, rather than deploying all apps on every push.

## Managing Shared Environment Variables in a Monorepo

In a monorepo, apps often share some environment variables (like a shared database URL) and have app-specific ones. In Pxxl, manage environment variables per project — this gives you fine-grained control over what each app can access. For shared variables, add them to each Pxxl project that needs them. This per-project isolation also improves security by ensuring your admin app's secrets are never accessible to the public web app.

### Ready to deploy on Pxxl?

Connect your GitHub repository and go live in under 30 seconds. No credit card required.

[Get started free](https://pxxl.app/signup)

monoreponigeriaturboreponxdeployment

## Related guides

[How-to Guide\\ \\ **How to Deploy a Full-Stack App in Nigeria — Frontend + Backend + Database**\\ \\ Deploy a complete full-stack app in Nigeria with a React frontend, Node.js or Python backend, and PostgreSQL database — all on one platform.](https://pxxl.app/guide/how-to-deploy-fullstack-app-nigeria) [How-to Guide\\ \\ **How to Deploy a Node.js App for Free in Nigeria — Complete Guide**\\ \\ Deploy Node.js apps (Express, NestJS, Fastify) for free in Nigeria. This guide covers Git deployment, environment variables, and keeping your app always online.](https://pxxl.app/guide/how-to-deploy-nodejs-app-nigeria) [How-to Guide\\ \\ **How to Deploy a Next.js App in Nigeria — Free Hosting in 5 Minutes**\\ \\ Deploy your Next.js application for free in Nigeria. This guide covers connecting GitHub to Pxxl, environment variables, custom domains, and SSR deployment.](https://pxxl.app/guide/how-to-deploy-nextjs-nigeria)