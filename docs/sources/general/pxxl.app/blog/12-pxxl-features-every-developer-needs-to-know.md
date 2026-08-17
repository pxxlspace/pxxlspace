# Source: https://pxxl.app/blog/12-pxxl-features-every-developer-needs-to-know

[Back to Blog](https://pxxl.app/blog)

Platform comparisons often focus on the features that are easiest to describe: deployment speed, framework support, free tier limits. The features that actually differentiate platforms are usually the ones that take longer to explain and that only become visible after you have been running a production application for a few months. This post goes deep on twelve Pxxl features that matter in practice, not just in theory. Each section explains what the feature is, why it exists, and what problems it solves that you might not have thought about yet.

## 1\. Proxy-backed deployments with automatic TLS and WebSocket support

Every deployment on Pxxl sits behind a central proxy that handles TLS termination, HTTPS enforcement, WebSocket proxying, and www alias routing automatically. When you attach a domain to a project, you do not configure a web server, write NGINX rules, or run a certificate manager. The proxy handles it. WebSocket connections work without special headers or separate endpoints. The www version of your domain works without a separate DNS record. None of this is opt-in. It is the default behavior for every deployment.

The practical consequence is that applications that use real-time features like WebSocket-based notifications, collaborative editing, or live data streams work on Pxxl without any configuration beyond what the application code already does. You do not discover three days after launch that your live feature is silently broken because the proxy does not forward WebSocket upgrades.

## 2\. Integrated domain registration with DNS management in the same dashboard

Most deployment platforms have no opinion about where you register domains or how you manage DNS. You use a registrar, you point DNS records wherever the hosting platform tells you, and you manage two or three separate admin panels for one deployed application. Pxxl handles domain registration directly. You can search, register, configure addons like WHOIS privacy, set renewal preferences, and manage all DNS records for the domain in the same dashboard where you manage deployments and databases. When you attach a registered domain to a project, the DNS records are created automatically. SSL certificates are issued automatically. The entire domain-to-deployment connection is one workflow in one product.

## 3\. Multi-engine database provisioning with dashboard-level inspection

Pxxl provisions PostgreSQL and MySQL databases in a managed infrastructure layer and makes the connection credentials available in the dashboard. Beyond provisioning, the platform gives you table inspection, column view, query logs, and connection statistics without requiring a local database client. You can verify that a migration ran correctly, check a table schema, or look at database-level error logs from the same dashboard where you check deployment logs. For debugging production issues at 2am, this kind of integrated visibility matters more than it does in any planning document.

## 4\. Encrypted user-controlled database backups

Database backups on Pxxl are encrypted before storage using a key controlled by the user, not the platform. The encryption key is generated on request and is the user's responsibility to store. Backups stored in object storage cannot be decrypted without it, including by Pxxl. Backup schedules are configurable (daily, weekly, monthly) and manual snapshots can be triggered at any time. This is particularly important before schema migrations or large data imports where you want a clean snapshot to restore from if something goes wrong. The backup command for each configuration is stored alongside the backup record so you know exactly how any given backup was produced.

## 5\. Rate limiting that never fails open

Pxxl's API rate limiting uses Redis as the primary counter store with an in-memory fallback for Redis outages. The critical design choice is that the fallback does not disable rate limiting. If Redis becomes unavailable, the in-memory fallback activates and rate limiting continues. Different endpoint categories have different limits. Authentication endpoints have conservative limits to resist credential stuffing and brute force. Standard endpoints have limits appropriate for normal usage. Rate limit headers are returned on every response so API clients can instrument proper backoff behavior.

## 6\. Pxxl tunnels: public endpoints for private infrastructure

Pxxl tunnels let you expose services running on private infrastructure to the public internet without opening firewall ports. Each tunnel is backed by a Cloudflare Tunnel at the infrastructure level. The platform provisions the tunnel, creates a unique hostname under pxxl.bio, sets up the required DNS record, and stores the tunnel token encrypted in the database. The pxxl-tunnel CLI connects the tunnel to your local or private service using the stored token. The hostname is immediately publicly accessible. No VPN, no port forwarding, no firewall rule changes. Tunnels are plan-limited. Higher-tier plans support more simultaneous tunnels.

## 7\. Preview deployments for every pull request

Preview deployments build and deploy every pull request to a temporary URL that lives only as long as the pull request is open. The preview runs on real infrastructure with the actual application code from the branch, not a simulated environment. Product designers, stakeholders, and QA can review changes before they merge. Environment variables for previews can be configured separately from production so preview deployments connect to staging services rather than production data. Preview URLs deactivate automatically when the pull request is closed or merged.

## 8\. CDN with cloud credits and edge functions

Pxxl's CDN gives every account object storage backed by a content delivery network. Assets receive public delivery URLs served from edge nodes. CDN usage is metered through a monthly credit allocation included in each plan. Edge functions extend the CDN with lightweight JavaScript or TypeScript code that runs at the delivery layer before requests reach the origin. Use cases include adding security headers, handling authentication at the edge, performing geographic redirects, and constructing simple responses without server round trips. Edge functions have the latency advantage of running geographically close to the user rather than on a distant origin server.

## 9\. Reseller API with project-scoped keys

Developers building products that include domain management for end users can use Pxxl's reseller API to expose domain search, pricing, availability checking, and registration within their own product. API keys can be scoped to a specific project, which means a reseller integration built for one client has access only to what that client needs and nothing else. The TLD pricing endpoint returns real-time registration and renewal prices for all supported extensions. The domain search endpoint checks availability in real time. The platform handles the registrar integration so the reseller application does not need to build or maintain it.

## 10\. Mono-repo support for large codebases

A project on Pxxl can be configured to build from a specific subdirectory of a repository. Build commands run relative to that subdirectory and changes outside it do not trigger builds for the project. A mono-repo containing a Next.js frontend, a Node.js API, and a separate admin panel maps to three independent Pxxl projects each building from its own directory. Each deploys on changes to its own code without triggering unnecessary builds in the others. This makes Pxxl usable for larger engineering organizations that have converged on mono-repo architectures for dependency management and cross-service changes.

## 11\. Blue-green deployments for zero-downtime releases

Blue-green deployment maintains two parallel production environments. Traffic routes to the active one. When a new version is ready, it is deployed to the inactive one and validated. Traffic is shifted atomically once the new version is confirmed healthy. The old version remains available briefly for immediate rollback if needed. The shift happens at the routing layer without dropped requests. Blue-green is available on plans that support it and is most valuable for applications where even momentary downtime during a deployment is harmful to user trust, such as payment flows, real-time communication applications, and high-traffic consumer products.

## 12\. Team collaboration with project-level permission scoping

Team members are invited to specific projects or to the full account. A member with project-level access can work within that project's scope but cannot see other projects, billing, or account settings. Permissions are enforced at the platform level, not by convention. When a contractor's engagement ends, access is revoked with a single action and takes effect immediately. Administrators have account-wide access and manage billing, project creation, and team member lifecycle. The separation between project-level and account-level roles means the principle of least privilege is practical rather than aspirational: you can give people exactly the access they need without giving them access to things they should not touch.