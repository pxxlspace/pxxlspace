# Source: https://pxxl.app/blog/building-scaling-saas-products-on-pxxl

[Back to Blog](https://pxxl.app/blog)

Shipping the first version of a product is a different problem from scaling that product once it has real users. The first version needs to be fast to deploy and easy to iterate. The scaled version needs to be reliable under load, safe to update without downtime, manageable by a team rather than a single person, and cost-controlled as usage grows. This post covers the Pxxl features that matter most in the transition from early-stage product to production SaaS.

## Preview deployments for safe iteration

Preview deployments are one of the most effective tools for maintaining velocity in a growing team without trading off production stability. When preview mode is enabled for a project, pull requests against the production branch trigger builds that deploy to temporary, isolated URLs. Each preview deployment runs the full build pipeline with the actual application code from the pull request, so the preview reflects exactly what would happen if the branch were merged.

Product designers can review UI changes on real infrastructure without needing to run a local environment. Non-engineering stakeholders can test features before they go live. Engineers can catch integration issues that only surface in a deployed environment. QA can run full test suites against each candidate build before it touches production. None of this requires any manual deployment steps. The preview URL is generated automatically when the pull request opens and deactivated automatically when it closes or is merged.

For applications that connect to external services and databases, previews can be configured to connect to staging versions of those services. Environment variables for preview deployments can be set separately from production environment variables, so preview builds do not interact with production data.

## Blue-green deployments for zero-downtime releases

Blue-green deployment is a release strategy where two identical production environments exist simultaneously. Traffic is routed to the currently active one (blue). When a new version is ready, it is deployed to the inactive one (green). Once the green deployment has been verified to be healthy, traffic is switched from blue to green atomically. The old environment remains available briefly in case an immediate rollback is needed. The switch happens at the routing layer without any request dropping.

On Pxxl, blue-green deployment is available on plans that support it. It is particularly valuable for applications where even brief downtime during a deployment is unacceptable, for example payment processing services, user-facing APIs, or any application where the user experience of seeing a loading error or 502 during a deployment is significantly harmful to trust.

The operational process is straightforward. When blue-green is enabled and a new deployment is triggered, the platform builds and deploys to the inactive slot. The deployment is validated. When ready, traffic is shifted. If monitoring shows a problem after the shift, rollback restores traffic to the previous slot within seconds.

## Team collaboration and permission scoping

As a product team grows past two or three people, managing access to production infrastructure becomes a real concern. You need engineers to be able to deploy to staging but not accidentally modify production environment variables. You need contractors to have access to the projects they are working on but not to billing or account settings. You need to be able to remove someone's access promptly when they leave the team without rotating every credential in the account.

Pxxl's team collaboration model is organized around projects and roles. A team member invited to a specific project can work within that project's scope. They can view deployments, push updates through the linked branch, and access project settings up to the level permitted by their role. They cannot see other projects in the account unless explicitly invited to them. This separation is enforced at the platform level, not just by convention.

Account-level roles give broader access to the team administrator. Administrators can manage billing, create and delete projects, invite and remove team members, and access account-wide settings. Separating these concerns means the principle of least privilege can be applied practically without excessive ceremony.

## API key scoping for integrations and resellers

API keys on Pxxl are the mechanism for programmatic access to your account. They can be scoped to all projects in the account or to a specific project. A key scoped to a specific project can only perform operations within that project's scope. This is important for several use cases.

If you are building a multi-tenant SaaS product where each tenant gets their own project, you can generate a per-project API key for each tenant's integration without giving any tenant visibility into other tenants' projects. If you are a developer agency managing multiple client accounts under a reseller model, per-project keys allow you to give clients programmatic access to their own project without exposing the agency account. If you have a CI/CD pipeline running outside of Pxxl's GitHub integration, a scoped key can be used to trigger deployments programmatically without granting the CI system full account access.

Keys can be revoked at any time. Revocation takes effect immediately. Keep a record of which integrations use which keys so that revocation does not silently break a dependent system. Rotate keys on a regular schedule and immediately if you have reason to believe a key has been compromised.

## CDN asset management for production applications

User-uploaded content, application assets, and media files that are served frequently benefit from being stored on a CDN rather than served directly from the application server. Pxxl's CDN system provides object storage backed by a content delivery network with edge caching. Files uploaded to the CDN receive public URLs that are served through the delivery network rather than from the origin, which reduces load on the origin server and improves delivery speed for geographically distributed users.

CDN usage is metered through a credit system. Each plan includes a monthly credit allocation. Credits are consumed based on storage and transfer usage. From the CDN panel, you can see your current usage, upload and manage files, organize content into buckets, and monitor delivery statistics. For applications that generate user-uploaded content at high volumes, the CDN reduces the storage and transfer load on application servers and provides more predictable delivery performance.

Edge functions extend the CDN by allowing lightweight code to run at the delivery layer. This is useful for request manipulation such as adding security headers, implementing authentication at the edge before a request reaches the origin, constructing redirects based on request parameters or geographic location, and serving dynamic responses to simple queries without routing traffic to the application server at all.

## Cron jobs for background processing

Most production applications need scheduled background tasks. Sending digest emails, cleaning up expired sessions, aggregating analytics, syncing data from external services, running database maintenance, and checking for events that need processing are all common examples. Pxxl cron jobs let you define these schedules within the platform rather than relying on an external scheduler or a separate cron service.

Cron jobs are configured with a schedule in standard cron syntax and an endpoint in your application that should be called when the schedule fires. Pxxl calls the endpoint according to the schedule and logs the result. If the job fails, the failure is recorded and visible in the dashboard. You can configure retry behavior and alerting for failed jobs. Cron jobs are scoped to a project so they can be managed alongside the rest of the project's configuration.

## Mono-repo support for larger codebases

Larger product teams often organize multiple applications, packages, or services in a single repository. This makes dependency management and cross-service changes simpler but creates challenges for deployment systems that expect a one-repository-to-one-project mapping. Pxxl's mono-repo support allows you to configure a project to build from a specific subdirectory of a repository. The build process runs within that subdirectory's context, install and build commands execute relative to it, and changes outside the subdirectory do not trigger builds for that project.

This allows multiple projects to live in the same repository while each one builds and deploys independently based on changes to its own subdirectory. A mono-repo containing a Next.js frontend, a Node.js API, and a separate admin panel can map to three separate Pxxl projects, each deploying on changes to its own directory without requiring the other projects to rebuild.

## Pxxl tunnels for hybrid infrastructure

Some applications run parts of their infrastructure on private networks that cannot be reached from the public internet. A machine learning inference service, a legacy data processing system, a local development server that needs to receive webhooks from external services, or an internal tool that needs a public URL for a specific integration are all examples. Pxxl tunnels solve this without requiring firewall rule changes or VPN configuration.

A Pxxl tunnel creates a secure connection from the private service to Pxxl's infrastructure and gives the service a public hostname under pxxl.bio. Traffic arriving at the hostname is routed through the tunnel to the private service. The tunnel token, which authorizes the connection, is generated and stored by the platform. The pxxl-tunnel CLI uses this token to establish the tunnel from the private network side. No inbound ports need to be opened.

Tunnel limits are per-plan. Higher-tier plans support more simultaneous tunnels, which is relevant for teams that need to expose multiple services or run multiple parallel environments simultaneously. Each tunnel has its own hostname and can be created, updated, or deleted independently.