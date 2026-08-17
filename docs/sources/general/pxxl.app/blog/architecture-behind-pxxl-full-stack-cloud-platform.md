# Source: https://pxxl.app/blog/architecture-behind-pxxl-full-stack-cloud-platform

[Back to Blog](https://pxxl.app/blog)

Building a cloud platform from scratch is one of the more challenging things a small team can take on. You are not just writing application code; you are building the substrate that other people will trust with their own products. Every design decision compounds. A bad abstraction at the infrastructure layer becomes a tax you pay on every feature for years. This post is an honest account of the architecture behind Pxxl, the trade-offs we made, and why we think the approach works for the developers and teams using it today.

## The starting point: one dashboard, no duct tape

Most developers who need to ship a web application end up assembling a stack from several unrelated services. A Git provider here, a hosting platform there, a separate domain registrar, a managed database on a third provider, an object storage bucket from a fourth, and then a monitoring tool on top. Each of these works individually, but they do not know about each other. You spend real time wiring them together and more time keeping the wiring intact as each service evolves independently.

The foundational decision at Pxxl was to collapse that surface into a single product. Deployments, domains, DNS, SSL certificates, databases, CDN storage, serverless tunnels, team collaboration, and billing all live inside the same system. That is not just a user experience preference. It has structural consequences. Because the platform owns the full lifecycle, it can do things that a collection of disconnected services cannot, like automatically attaching a CDN record after a domain is verified, provisioning a database that is network-adjacent to a deployment, or giving a team member scoped access to a single project without granting them access to the whole account.

## The build layer: GitHub-first deployments

Pxxl's deployment system is built around Git repositories as the source of truth. When a user links a project to a GitHub repository, they specify a branch. That branch relationship is exact. When a webhook arrives, the platform checks whether the ref matches the project's linked branch before processing the build. This prevents a common problem on looser platforms where a push to any branch triggers an unexpected production build.

The build environment handles a range of frameworks including Next.js, React, Node.js, Python, PHP, static HTML, and others. Framework detection runs at project creation time and suggests install and build commands based on the detected package manager and project structure. Users can override these at any time. Build output is streamed in real time to the deployment log, which is queryable from the dashboard and accessible to every team member with the right permissions.

Rollback deployments are stored and surfaced in the dashboard. If a new build introduces a regression, a team can redeploy a previous successful build with a single action without needing to revert a Git commit or touch the repository at all.

## The domain and DNS layer

Domain registration on Pxxl goes through a registrar integration that handles the full lifecycle from availability search through registration, DNS provisioning, addon selection such as WHOIS privacy, and renewal settings. When a user registers a domain, the platform automatically creates a DNS zone for it and sets up the initial records. When a domain is attached to a deployed project, the A record pointing to the load balancer is provisioned without manual input.

Custom domains attached to existing projects follow a verification flow. The platform generates a CNAME or TXT record that the user adds to their external DNS provider. Once verified, SSL certificates are issued and managed automatically. Certificate renewal is handled by the platform; users do not need to think about it after initial setup.

DNS records are manageable from the dashboard as well. Users can create, update, and delete A, CNAME, MX, TXT, and other record types directly without logging into a separate DNS management panel. For domains registered through Pxxl, the platform is the authoritative nameserver and all changes propagate through its infrastructure.

## The database layer: provisioning and management

Database infrastructure on Pxxl is provisioned through a managed backend that handles resource allocation, network configuration, and lifecycle events. Users can create PostgreSQL and MySQL instances from the dashboard and connect to them using the credentials displayed in the database settings panel. Each database runs in an isolated environment with its own connection string.

The platform tracks database status, resource usage, and connection health. Database logs are accessible from the dashboard for debugging connection issues or query problems. Users can update credentials, view tables and columns without leaving the dashboard, and configure backup schedules that store encrypted snapshots to object storage.

The backup system uses an encryption model tied to the user's account. Encryption keys can be generated per user and stored securely. Backup commands are generated server-side based on the database type and connection parameters, and the resulting encrypted archive is stored with a defined retention period. Restoration uses the same key material and decrypts directly in the client context, so the unencrypted data never transits the Pxxl API layer.

## The CDN layer: cloud credits and asset delivery

Pxxl's CDN is built on top of R2-compatible object storage. Each user account has a CDN space where assets can be uploaded directly from the dashboard or through the API. Uploaded files receive public URLs that are served through the platform's edge delivery network. The system tracks upload and delivery events through a credit ledger, where each plan includes a monthly allocation of cloud credits. Credits are consumed based on data transfer and storage usage.

Edge functions are another capability at this layer. Users can deploy small JavaScript or TypeScript functions that run at the edge, attached to CDN assets or project routes. This is useful for request transformation, authentication at the edge, redirects, and lightweight API responses that do not need a full server-side deployment.

## Pxxl tunnels: private infrastructure, public endpoints

Pxxl tunnels give developers a way to expose services running on private infrastructure to the public internet without opening firewall ports or configuring complex networking. Each tunnel is backed by a Cloudflare Tunnel at the infrastructure level. The platform provisions the tunnel, creates a hostname under pxxl.bio, creates the required DNS record, and stores the tunnel token encrypted in the database. The user gets a hostname they can point traffic to, and the pxxl-tunnel CLI connects the tunnel to their local or private service.

Tunnel access is a plan-level feature. The number of tunnels a user can maintain is determined by their subscription tier. This keeps shared infrastructure load predictable while giving higher-tier users more flexibility to expose multiple private services.

## Team collaboration and API key scoping

Teams in Pxxl are organized around projects. A team member can be invited to collaborate on a specific project or across the account. Permissions are scoped so that a contractor working on one project does not have visibility into other projects, billing, or account settings unless explicitly granted.

API keys are another scoping mechanism. A key can be restricted to a single project, which makes it safe to embed in a client-specific integration or reseller workflow without exposing the full account. Keys can be rotated or revoked from the dashboard at any time. The reseller API allows third parties to build domain search, pricing, and checkout flows on top of Pxxl's domain infrastructure using their own account credentials scoped appropriately.

## What comes next

The architecture is designed to grow with the products being built on it. Auto-scaling, blue-green deployments, mono-repo support, and deployment protection gates are features that extend the build layer. The database layer will expand to cover more engine types and managed read replicas. The CDN layer is getting more capable edge function tooling. The tunnel layer will add more flexibility around hostnames and routing rules. The goal throughout is to keep the surface simple while making the substrate more capable, because the best infrastructure is the kind you do not have to think about when you are trying to ship your product.