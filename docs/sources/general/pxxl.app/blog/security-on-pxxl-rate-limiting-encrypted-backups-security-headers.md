# Source: https://pxxl.app/blog/security-on-pxxl-rate-limiting-encrypted-backups-security-headers

[Back to Blog](https://pxxl.app/blog)

Security in a cloud platform is not a single feature. It is a set of overlapping layers where each layer addresses a different class of threat, and where the gaps between layers are just as important as the layers themselves. A platform can have strong TLS but weak rate limiting. It can have good perimeter security but poor encryption of stored data. It can have excellent network-level protection but ship applications with headers that leave browsers vulnerable to common client-side attacks. Pxxl's security model is designed as a stack of complementary layers rather than a collection of checkbox features. This post explains each layer in enough detail to understand what it protects against and why it matters.

## Rate limiting: protecting the API and user endpoints

Rate limiting is the practice of restricting how many requests a client can make to an endpoint within a defined time window. Without rate limiting, any endpoint that performs meaningful work, such as authenticating a user, sending an email, or processing a payment, can be targeted by automated scripts that attempt to brute-force credentials, exhaust resources, or generate large volumes of side-effect events like password reset emails.

Pxxl's rate limiting system is implemented at the API gateway level, in front of all endpoints. It uses Redis as the primary counter store, with per-IP, per-endpoint counters keyed by client IP address, HTTP method, and route path. Each counter is incremented on every request and compared against a configured limit. If the limit is exceeded, the endpoint returns a 429 Too Many Requests response with headers indicating the limit, the remaining allowance, and the number of seconds until the window resets. The client has enough information to implement proper backoff without needing to guess at the platform's behavior.

The rate limiting system is resilient to Redis failures. If the Redis counter store becomes unavailable, the system falls back to an in-memory counter store on the gateway instance rather than failing open and allowing unlimited requests. Failing open would mean that a Redis outage becomes a window of zero rate limiting, which is precisely the window an attacker might try to exploit. The in-memory fallback maintains protection continuity during infrastructure events at the cost of counter state not being shared across gateway instances during the fallback period.

Different endpoint classes have different rate limit configurations. Authentication endpoints, including login, signup, OAuth initiation, and password reset, have conservative limits because these are the endpoints most commonly targeted by credential stuffing, brute force, and enumeration attacks. Standard API endpoints have higher limits appropriate for normal application usage patterns. The platform surfaces rate limit headers on every response so developers consuming the API can instrument their clients to handle throttling gracefully.

## Per-endpoint throttling for high-risk operations

Beyond general rate limiting, Pxxl applies specific throttles to the highest-risk operations. Signup endpoints are rate-limited separately from login endpoints because mass account creation attacks have a different pattern and different consequences than login brute force. Password reset endpoints are rate-limited to prevent attackers from flooding a target user's email inbox with reset links or enumerating which email addresses have accounts. OAuth initiation endpoints are rate-limited to prevent abuse of the OAuth flow as an enumeration vector.

The key insight behind this design is that not all endpoints carry equal risk. A rate limit appropriate for a search endpoint would be dangerously loose for a password reset endpoint. Configuring limits per endpoint class rather than applying a single global limit allows the platform to be appropriately strict where it matters and appropriately permissive where it does not.

## Security headers: protecting the browser layer

A significant class of web application vulnerabilities is exploited at the browser layer rather than the server layer. Cross-site scripting injects malicious scripts into pages viewed by other users. Clickjacking embeds a page in a hidden iframe and tricks users into clicking on it. Mixed content silently downgrades HTTPS connections to HTTP for specific resources. These vulnerabilities are prevented not by server-side validation but by HTTP response headers that instruct the browser to enforce specific security policies.

Pxxl's platform applies a comprehensive set of security headers to all served content. The Content-Security-Policy header specifies which sources are allowed to provide scripts, styles, images, fonts, and connections. It prevents inline script injection and restricts which external domains can serve resources to the page. The Strict-Transport-Security header tells browsers to only connect to the domain over HTTPS, even if an HTTP URL is entered, for a period of one year with the preload flag set. The X-Frame-Options header prevents the page from being embedded in iframes on other origins, blocking clickjacking. The X-Content-Type-Options header prevents browsers from MIME-sniffing responses, which can cause the browser to execute a file it should be treating as data. The Referrer-Policy header controls how much of the current URL is sent in the Referer header on outgoing requests. The Permissions-Policy header restricts which browser APIs the page can request, preventing unexpected access to cameras, microphones, and geolocation by default.

These headers are applied at the server level, which means they are present on every response regardless of whether the application code sets them. A developer who forgets to set a Content-Security-Policy in their application still has one applied by the platform. This is defense in depth: the platform's security layer fills gaps that application code might leave open.

## TLS everywhere and certificate management

All communication between users and Pxxl-hosted applications is encrypted with TLS. This applies to Pxxl subdomains, custom domains attached to projects, and the Pxxl platform API itself. TLS certificates are issued and renewed automatically by the platform. Developers do not manage certificate files, renewal schedules, or certificate authority configurations.

Certificate issuance is triggered automatically when a domain is attached to a project and verified. The verification process confirms that the person attaching the domain controls it, which prevents a domain from being hijacked by a different account. Once verified and issued, the certificate is stored and served by the proxy layer. Renewal happens before the certificate expires. If renewal fails, the platform alerts the account and retries before the certificate becomes invalid.

The TLS configuration used by Pxxl's proxy follows current best practices for cipher suites and protocol versions. Older TLS versions with known vulnerabilities are not supported. This means connections to Pxxl-hosted applications from older browsers or clients that only support TLS 1.0 or 1.1 will fail, which is the correct security tradeoff. Supporting outdated protocol versions would allow downgrade attacks that compromise the encryption entirely.

## Encrypted database backups

Database backups contain a complete snapshot of your application's most sensitive data: user accounts, personal information, transaction history, and whatever else your application stores. An unencrypted backup file that is exposed or stolen is as dangerous as a live database compromise. It contains exactly the same information, in a portable format that requires no special access to read.

Pxxl's backup system encrypts backup archives before storing them. The encryption key is tied to the user account, not to the Pxxl platform. This means the backup file stored in object storage cannot be decrypted by anyone who does not have the encryption key, including Pxxl. If an attacker gained access to the object storage bucket where backups are stored, they would find encrypted files that are computationally infeasible to decrypt without the key.

The user's encryption key must be stored and managed by the user. The platform generates the key but does not retain it after it is displayed. If the key is lost, encrypted backups cannot be recovered. This is an intentional design decision that follows the principle that the party whose data is being protected should control the encryption key, not the service provider. Pxxl recommends storing encryption keys in a password manager or a secrets management service outside of the platform.

## Credential isolation and API key scoping

Credential isolation prevents a compromised credential from giving an attacker access to more than the minimum necessary scope. On Pxxl, API keys can be scoped to a single project. A key that is scoped to one project cannot read data from, write to, or perform actions in any other project. If a scoped key is exposed, the attacker can only interact with the one project the key covers.

Database credentials are project-specific. A database created in one project has connection credentials that cannot be used to connect to databases in other projects. If an application leaks its own database credentials, the damage is contained to the application's own database.

Team member permissions follow the same principle. A team member invited to collaborate on one project cannot see or modify other projects in the account. An account administrator can revoke a team member's access at any time, and the revocation takes effect immediately. If a team member leaves an organization or a contractor's engagement ends, their access can be removed with a single action.

## Input validation and injection prevention at the platform layer

The Pxxl API applies strict input validation at the gateway before requests reach business logic. Domain names are validated against regular expressions before being registered with the proxy. URLs are validated for scheme and host before being used in outbound requests. Path parameters are validated for format before being used in queries. This validation catches malformed input before it can interact with downstream systems in unexpected ways.

Injection attacks work by inserting unexpected characters into inputs that are later interpreted in a different context. A SQL injection inserts SQL syntax into a form field that gets embedded in a database query. A command injection inserts shell metacharacters into an input that gets passed to a system command. A path traversal inserts directory separator characters into a filename that gets used in a file system path. Validating inputs at the boundary, before they reach any context where they could be interpreted, is the first and most reliable defense against these attack classes.