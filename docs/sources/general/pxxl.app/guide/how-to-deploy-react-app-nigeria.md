# Source: https://pxxl.app/guide/how-to-deploy-react-app-nigeria

How-to Guide6 min read2026-05-23

# How to Deploy a React App for Free as a Nigerian Developer

React is the most widely used frontend framework among Nigerian developers. This guide shows you how to deploy a React single-page application for free, with a custom domain and HTTPS, in under ten minutes.

## Building Your React App for Production

In your React project directory, run 'npm run build' to generate the production build in the 'build' folder. Confirm the build runs without errors before deploying. If you use environment variables in React (prefixed with REACT\_APP\_), collect them — you'll add them to Pxxl's environment settings. Push your project to GitHub if you haven't already.

## Deploying on Pxxl

Log in to pxxl.app, click 'New Project', and connect your React GitHub repository. Pxxl detects Create React App or Vite automatically and sets the build command to 'npm run build' and the output directory to 'build' or 'dist'. Add any REACT\_APP\_ environment variables. Click Deploy — Pxxl builds your app and serves it from its global CDN. Your React app is live at a \*.pxxl.app URL.

## Handling React Router with Client-Side Routing

If your React app uses React Router for client-side navigation, add a rewrite rule in your Pxxl project settings so all routes serve index.html. In Pxxl's configuration, add '/\* -> /index.html' as a redirect rule. This ensures that when a Nigerian user navigates directly to a deep URL like '/dashboard/profile', your React app loads correctly instead of returning a 404.

### Ready to deploy on Pxxl?

Connect your GitHub repository and go live in under 30 seconds. No credit card required.

[Get started free](https://pxxl.app/signup)

reactnigeriadeploymentspa

## Related guides

[How-to Guide\\ \\ **How to Deploy a Next.js App in Nigeria — Free Hosting in 5 Minutes**\\ \\ Deploy your Next.js application for free in Nigeria. This guide covers connecting GitHub to Pxxl, environment variables, custom domains, and SSR deployment.](https://pxxl.app/guide/how-to-deploy-nextjs-nigeria) [Alternative\\ \\ **Best Netlify Alternative for Nigerian Developers in 2026**\\ \\ Netlify is great for static sites but Nigerian developers face payment and pricing challenges. Find a Netlify alternative with better local support and zero-config deployments.](https://pxxl.app/guide/netlify-alternative-nigeria) [How-to Guide\\ \\ **How to Host Your Portfolio Website for Free as a Nigerian Developer**\\ \\ Host your developer portfolio for free as a Nigerian developer. This guide covers deploying a portfolio site with a custom domain, HTTPS, and always-on uptime.](https://pxxl.app/guide/how-to-host-portfolio-website-nigeria)