# Source: https://pxxl.app/guide/how-to-integrate-pxxl-domain-api-nuxt

How-to Guide8 min read2026-05-28

# How to Integrate Pxxl Domain Reseller API into a Nuxt Application

Learn how to connect Pxxl's domain reselling capabilities directly into your Application application. This step-by-step guide is optimized for developers scaling in Nigeria and Africa.

## Setting Up Your Nuxt Project and API Route Handler

Start by setting up a fresh Nuxt project. To keep your reseller API key secure, create a server-side route handler that acts as a proxy. This ensures your client-side code never exposes the Bearer token used to authenticate with Pxxl.

## Creating the Real-Time Domain Search Interface

Using Pxxl's \`POST /reseller/domains/search\` endpoint, you can create a fast, responsive domain search bar in your frontend. The API returns domain availability, TLD support status, and wholesale prices in less than 200ms.

## Handling Checkout, Authentication, and Scoped Tokens

When a user decides to purchase a domain, fetch their contact details (registrant information) and query Pxxl. Ensure you have scoped your API key to "reseller:write" to allow registrations, and that your wallet has enough balance to cover the registration fee.

## Listening to Webhooks and Handling Provisioning

Configuring webhooks in Pxxl allows you to receive instant notifications once the domain is registered. Pxxl handles the upstream DNS delegation and registrar communication, letting your backend mark the order as complete automatically.

### Ready to deploy on Pxxl?

Connect your GitHub repository and go live in under 30 seconds. No credit card required.

[Get started free](https://pxxl.app/signup)

domain apiintegrationtutorialdeveloper toolsnuxt

## Related guides

[How-to Guide\\ \\ **How to Start a Profitable Domain Reseller Business in Nigeria (2026)**\\ \\ A complete blueprint for Nigerian developers and entrepreneurs to start a domain reselling business using Pxxl reseller APIs and local payments.](https://pxxl.app/guide/how-to-start-domain-reseller-business-nigeria) [Best Of\\ \\ **Best Domain Reseller APIs in Nigeria for 2026 — Features & Pricing Compared**\\ \\ Looking for a reliable domain reseller API with Naira support? Compare the top APIs in Nigeria including Pxxl, WHMCS integrations, and legacy providers.](https://pxxl.app/guide/best-domain-reseller-api-nigeria-2026)