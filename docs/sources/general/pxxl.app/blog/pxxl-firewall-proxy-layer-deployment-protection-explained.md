# Source: https://pxxl.app/blog/pxxl-firewall-proxy-layer-deployment-protection-explained

[Back to Blog](https://pxxl.app/blog)

Most developers deploying applications on cloud platforms interact with the security layer only when something breaks. A certificate does not renew. A WebSocket connection refuses to upgrade. A domain stops resolving after a DNS change. A surge in traffic takes down a service that seemed healthy minutes before. These moments reveal how much invisible infrastructure sits between the application and the users it serves. On Pxxl, that infrastructure is the proxy and firewall layer, and understanding how it works explains why deployments on the platform behave the way they do under normal conditions and under stress.

## What the Pxxl proxy actually is

Every deployment on Pxxl sits behind a central proxy layer. The proxy is the component that receives incoming HTTPS requests, terminates TLS, determines where to route the request based on the domain, forwards the request to the appropriate application server, and returns the response to the caller. This is a standard reverse proxy architecture, but the details of implementation matter a great deal for reliability, security, and performance.

Pxxl's proxy is built around a domain registration model. When a project is deployed and a domain is attached, the platform registers the domain with the proxy automatically. This registration includes the target IP address and port of the application server, TLS configuration, WebSocket support settings, and routing rules. The registration happens without any developer action. From the developer's perspective, they attach a domain to a project and it works over HTTPS, handles WebSocket connections, and routes traffic correctly. The proxy configuration that makes this possible is managed entirely by the platform.

The proxy supports TLS natively. Every domain registered with the proxy gets HTTPS without requiring the developer to manage certificates, configure NGINX SSL directives, or run certbot. TLS is terminated at the proxy layer, meaning the encrypted connection from the browser ends at the proxy, not at the application server. The connection between the proxy and the application server runs on the internal network. This architecture keeps TLS management centralized, makes certificate renewal invisible to developers, and ensures that every deployment is served over HTTPS regardless of how the application server itself is configured.

## WebSocket support and the www alias

WebSocket connections present a particular challenge for reverse proxies because they are long-lived, bidirectional connections rather than the short-lived request-response pattern that HTTP handles natively. A proxy that does not explicitly support WebSocket upgrades will break WebSocket connections silently, which causes applications that use real-time features like chat, live notifications, collaborative editing, or streaming to fail in ways that are difficult to diagnose.

Pxxl's proxy explicitly enables WebSocket proxying for every registered domain. The allow\_websocket setting is enabled by default when a domain is registered. This means applications that use WebSocket connections, whether through socket.io, native WebSocket APIs, or WebSocket-based frameworks, work through the proxy without any additional configuration. The developer does not need to add a special header, configure a separate WebSocket endpoint, or handle the WebSocket upgrade separately from HTTP traffic.

The www alias feature automatically routes www-prefixed requests to the same application as the apex domain. A deployment reachable at example.com is also reachable at www.example.com without requiring a separate DNS record or separate proxy registration. This handles the common case where users type www in front of any domain by habit. Both variations serve the same application and both use HTTPS.

## Load balancing and the round-robin algorithm

The proxy uses a round-robin load balancing algorithm to distribute incoming requests across the upstream servers configured for a domain. Round-robin is the simplest effective load balancing strategy: each incoming request is forwarded to the next server in a rotation, distributing load evenly across all available servers. For most web applications with stateless request handling, round-robin produces a well-distributed load without requiring sophisticated health-check infrastructure or sticky session configuration.

The upstream configuration allows multiple servers to be registered for a single domain, each with a configurable weight. A server with weight 2 receives twice as many requests as a server with weight 1. This allows gradual traffic shifting during deployments, where a new version of the application can receive a fraction of traffic while the old version continues to serve most requests. If the new version behaves correctly, the weight can be shifted until all traffic routes to it. If it does not, traffic can be shifted back to the stable version without downtime.

## Path-level routing and middleware

Beyond domain-level routing, the proxy supports path-level routing rules. Different URL prefixes can be routed to different upstreams. An API path might route to a Node.js server while a static file path routes to a different origin. Path-level middlewares allow additional processing to be applied to specific route prefixes without affecting all traffic to the domain.

This architecture is relevant for teams that are running microservices or splitting their application across multiple servers behind a single domain. The proxy handles the routing logic at the network layer, which is more efficient than routing at the application layer and does not require the application to know about its sibling services.

## Domain validation and security at registration

The proxy layer enforces domain format validation before any domain is registered. Internal Pxxl domains (subdomains under pxxl.click, pxxl.space, pxxl.pro, pxxl.dev, pxxl.codes, and pxxl.bio) are validated against a strict regular expression that rejects anything that does not match the expected subdomain format. External custom domains are validated against a general hostname format that rejects IP addresses, malformed domain strings, and anything containing characters outside the valid domain name character set.

This validation is not just syntactic. It prevents a class of attacks where a maliciously crafted domain string could be used to manipulate the proxy configuration, cause path traversal in routing logic, or inject unexpected characters into HTTP headers. The proxy registration process treats domain names as opaque strings to be validated and registered, not as user-controlled format strings that get executed in a routing context.

## DDoS mitigation and the protection layer

Distributed denial-of-service attacks attempt to overwhelm a server or network by flooding it with requests from many sources simultaneously. The goal is to consume enough resources, whether bandwidth, CPU, or connection slots, that the target cannot respond to legitimate requests. Modern DDoS attacks can generate millions of requests per second from botnets distributed across thousands of IP addresses.

Pxxl's proxy layer is the first line of defense against these attacks. Because all traffic to deployed applications passes through the central proxy before reaching application servers, the proxy can apply rate limiting and traffic filtering at a layer that sits in front of the application infrastructure. Volumetric attacks that would overwhelm an application server hit the proxy first, where they can be detected, rate-limited, and dropped before they reach the application.

DDoS mitigation is included for paid plans. This is not just a marketing description of existing rate limiting. It is a specific commitment to traffic filtering and attack mitigation at the infrastructure level, managed by the platform rather than requiring developers to configure it themselves. For most developers, configuring effective DDoS protection requires expertise in network-level filtering, familiarity with attack patterns, and access to infrastructure that can absorb large volumes of traffic. The Pxxl proxy layer provides this without requiring any of that expertise from the developer.

## HTTPS enforcement and the security posture

The proxy's forceHttps setting, when enabled, rejects plain HTTP connections and redirects them to HTTPS. This is important for production applications where sending data over unencrypted connections would be a security vulnerability. Session cookies, authentication tokens, user-submitted form data, and API payloads that transit over HTTP are visible to anyone with access to the network path between the user and the server.

HTTPS enforcement at the proxy layer means that even if an application server was started without explicit HTTPS configuration, traffic to it through the proxy is still encrypted between the user and the proxy. The application developer does not need to set up TLS on the server itself. The security boundary is maintained at the proxy, and the certificate management is handled by the platform.

Combined with the security headers applied at the application layer (Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), every Pxxl deployment has a security posture that reflects current best practices without requiring the developer to configure any of it. These are not features you opt into. They are the default state of every deployment.

## Resync and configuration updates

When a deployment changes, the proxy configuration needs to update to reflect the new application server address. Pxxl handles this automatically as part of the deployment process. When a new deployment is completed, the platform resyncs the proxy registration for the domain to point to the new server. From the user's perspective, traffic routes to the new deployment as soon as it is ready. There is no manual proxy reconfiguration step.

The resync operation is idempotent. If it runs multiple times with the same parameters, the result is the same. If a resync fails partway through, retrying it will not create a corrupted or duplicated configuration. This reliability matters because proxy configuration updates happen during deployments, which are already high-activity moments where failures have user-visible consequences.