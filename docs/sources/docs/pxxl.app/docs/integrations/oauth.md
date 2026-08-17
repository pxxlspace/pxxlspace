# Source: https://pxxl.app/docs/integrations/oauth

OAuth Integrations

# OAuth Integrations

Create OAuth integrations, configure callbacks, request user consent, exchange authorization codes, and read public Pxxl user data.

OAuth integrations let your product ask a signed-in Pxxl user to share permissioned public account data through a consent screen. Use this guide when you want another app, CLI, dashboard, customer portal, internal tool, or marketplace workflow to connect to a Pxxl account.

![Dashboard integrations page](https://cdn.pxxl.app/docs/dashboard-screenshots/39-integrations-page.png)

## [What You Can Build](https://pxxl.app/#what-you-can-build)

| Use case | What OAuth gives you |
| --- | --- |
| Customer dashboards | Let users connect Pxxl without sharing passwords or personal API keys. |
| CLI tools | Authorize a local or external CLI with a short-lived OAuth code. |
| Partner apps | Request only the scopes needed for your integration. |
| Internal automation | Pair a user identity with a backend workflow and signed webhook events. |
| Marketplace flows | Connect a user once, then refresh your own integration state from approved scopes. |

## [Create an OAuth app](https://pxxl.app/#create-an-oauth-app)

Go to **Dashboard > Integrations** and create an OAuth application.

![Create OAuth integration form](https://cdn.pxxl.app/docs/dashboard-screenshots/40-integration-create-form.png)

| Field | Use |
| --- | --- |
| Application name | The name users see on the authorization screen. |
| Project link | Public URL for your product, dashboard, or integration. |
| Webhook URL | Your backend endpoint for future integration events. |
| Callback URL | Default redirect URL after a user authorizes your app. |
| Redirect URIs | Exact URLs that can receive authorization codes. |
| Scopes | The user data your app is allowed to request. |

The dashboard shows the client secret once. Store it server-side only. If you rotate the secret later, update your backend before sending new authorization traffic through that app.

## [Setup Checklist](https://pxxl.app/#setup-checklist)

1. Open **Dashboard > Integrations**.
2. Click **Create Integration**.
3. Add a clear application name and logo so users recognize the app during consent.
4. Set the public project link for the product requesting access.
5. Add your backend webhook URL if you want instant `oauth.authorized`, `oauth.denied`, and `oauth.revoked` events.
6. Add the exact callback URL your backend uses after authorization.
7. Add every allowed redirect URI. These must match exactly, including protocol, path, and trailing slash.
8. Choose the smallest scope set needed for the first version.
9. Copy the client ID and client secret into your backend secret store.
10. Test the authorization URL in a private browser window.

## [Dashboard Management](https://pxxl.app/#dashboard-management)

Use **Dashboard > Integrations** to search apps, inspect callback settings, rotate secrets, test webhooks, and delete apps that should no longer accept authorization requests.

![Connected apps settings page](https://cdn.pxxl.app/docs/dashboard-screenshots/settings-connected-apps.png)

Users can review and remove connected OAuth apps from **Dashboard > Settings > Connected Apps**. When a user removes an app, Pxxl revokes active OAuth access tokens for that user/application pair and sends an `oauth.revoked` webhook to your configured webhook URL.

## [Scopes](https://pxxl.app/#scopes)

| Scope | Data returned |
| --- | --- |
| `profile` | User name and profile picture. |
| `email` | Primary email address and verification state. |
| `github` | Linked GitHub ID, login, name, email, and avatar when connected. |
| `key` | Stable public Pxxl user key. |

## [Authorization URL](https://pxxl.app/#authorization-url)

Send the user to:

```
https://pxxl.app/auth/oauth/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=https%3A%2F%2Fexample.com%2Foauth%2Fpxxl%2Fcallback&scope=profile%20email%20github&state=YOUR_CSRF_STATE
```

`redirect_uri` must exactly match one of the redirect URIs in the OAuth application. You can also pass `callback_url` for browser flows that already use that parameter name.

If the user is not signed in, Pxxl stores the request locally, sends them through login, and returns them to the consent screen.

## [Consent Screen Behavior](https://pxxl.app/#consent-screen-behavior)

The consent screen shows the application name, logo, project link, requested scopes, and the Pxxl account that will authorize access. If a user has already approved the same app with the same or narrower scopes, Pxxl can skip the consent screen and redirect immediately with a new one-time code. If you request a new scope, the user must approve the expanded access.

## [Exchange the code](https://pxxl.app/#exchange-the-code)

Exchange the one-time code from your backend:

```
curl -X POST https://gateway.pxxl.app/api/v3/auth/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "code": "CODE_FROM_CALLBACK",
    "redirect_uri": "https://example.com/oauth/pxxl/callback"
  }'
```

The response includes a bearer token:

```
{
  "access_token": "pxxl_oat_...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "profile email github"
}
```

## [Read user info](https://pxxl.app/#read-user-info)

```
curl https://gateway.pxxl.app/api/v3/auth/oauth/userinfo \
  -H "Authorization: Bearer pxxl_oat_..."
```

Example response:

```
{
  "sub": "public-user-key",
  "name": "Ada Lovelace",
  "picture": "https://...",
  "email": "ada@example.com",
  "emailVerified": true,
  "github": {
    "id": "12345",
    "login": "ada",
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "avatarUrl": "https://..."
  }
}
```

Only fields covered by the approved scopes are returned.

## [OAuth Webhooks](https://pxxl.app/#oauth-webhooks)

When a user authorizes, denies, or revokes your application, the Pxxl backend dispatches a secure webhook POST request to your application's configured `Webhook URL`.

This allows your backend to instantly map the user's incoming authorization code with their stable public Pxxl User ID. By the time the user is redirected back to your callback URL with the `code` parameter, your system already knows exactly who they are, enabling instant page loading and pairing.

### [Webhook Headers](https://pxxl.app/#webhook-headers)

Every webhook dispatch includes secure signature headers to ensure the payload was not tampered with and was sent by Pxxl:

- `X-Pxxl-Signature`: An HMAC-SHA256 signature generated using your application's hashed client secret as the key.
- `X-Pxxl-Timestamp`: A Unix timestamp (in seconds) representing when the webhook was sent, allowing you to reject replay attacks.
- `X-Pxxl-Event`: The event name, such as `oauth.authorized`, `oauth.denied`, or `oauth.revoked`.
- `X-Pxxl-Action-Type`: The same event name, included for receivers that route by action headers.

### [Event payloads](https://pxxl.app/#event-payloads)

#### [`oauth.authorized`](https://pxxl.app/#oauthauthorized)

Sent when a user accepts the consent screen or repeats a previously approved authorization request.

```
{
  "event": "oauth.authorized",
  "timestamp": 1716723456,
  "data": {
    "code": "pxxl_code_abc123xyz...",
    "userId": "3b7b2518e38d7285a864d38202d...",
    "scopes": ["profile", "email"]
  }
}
```

#### [`oauth.denied`](https://pxxl.app/#oauthdenied)

Sent when a signed-in user rejects the consent screen.

```
{
  "event": "oauth.denied",
  "timestamp": 1716723456,
  "data": {
    "userId": "3b7b2518e38d7285a864d38202d...",
    "scopes": ["profile", "email"],
    "redirectUri": "https://example.com/oauth/pxxl/callback",
    "reason": "access_denied",
    "deniedAt": "2026-05-31T06:45:00Z"
  }
}
```

#### [`oauth.revoked`](https://pxxl.app/#oauthrevoked)

Sent when a user removes your app from their connected apps in Pxxl settings.

```
{
  "event": "oauth.revoked",
  "timestamp": 1716723456,
  "data": {
    "userId": "3b7b2518e38d7285a864d38202d...",
    "scopes": ["profile", "email"],
    "reason": "user_revoked",
    "revokedAt": "2026-05-31T06:50:00Z"
  }
}
```

> \[!NOTE\] If you trigger a test webhook using the developer tools endpoint `POST /api/v3/auth/oauth/apps/:id/test-webhook`, the `event` will be `"oauth.test"`.

### [Signature Verification](https://pxxl.app/#signature-verification)

To verify the signature in your application backend:

1. Concatenate the timestamp, a period `.`, and the raw request body payload: `timestamp + "." + rawBody`.
2. Hash your raw `client_secret` using SHA-256 (hex-encoded) to obtain the signing key (matching how Pxxl secures it internally).
3. Compute the HMAC-SHA256 signature of the concatenated string using the key.
4. Perform a constant-time string comparison (to prevent timing attacks) between your calculated signature and the `X-Pxxl-Signature` header value.

Here is a ready-to-use Node.js implementation:

```
const crypto = require('crypto');

/**
 * Verify Pxxl webhook signature
 * @param {string} rawBody - Raw JSON payload string from the request body
 * @param {string} timestamp - Value from the X-Pxxl-Timestamp header
 * @param {string} signatureHeader - Value from the X-Pxxl-Signature header
 * @param {string} clientSecret - Your raw OAuth application Client Secret
 * @returns {boolean} - Returns true if the signature is valid, false otherwise
 */
function verifyPxxlWebhook(rawBody, timestamp, signatureHeader, clientSecret) {
  // 1. Derive the signing key by hashing the raw client secret (SHA-256 hex)
  const key = crypto.createHash('sha256').update(clientSecret).digest('hex');

  // 2. Concatenate the timestamp and raw body payload
  const message = `${timestamp}.${rawBody}`;

  // 3. Compute the expected HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac('sha256', key)
    .update(message)
    .digest('hex');

  // 4. Perform a timing-safe, constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader, 'utf-8'),
    Buffer.from(expectedSignature, 'utf-8')
  );
}
```

## [Repeat consent and automatic bypass](https://pxxl.app/#repeat-consent-and-automatic-bypass)

Once a user has authorized your application with a set of scopes, they will not see the consent screen again when accessing the authorization URL with the same or a subset of those scopes. Pxxl automatically verifies their active authorization status in the database, generates a new code, and redirects them to your callback URL instantly. If you request a new scope that the user has not previously approved, they will see the consent screen displaying the new permissions.

## [Troubleshooting OAuth](https://pxxl.app/#troubleshooting-oauth)

Authorization redirects back with `invalid_redirect_uri`

The `redirect_uri` query parameter must exactly match one of the redirect URIs saved on the OAuth app. Check the protocol, domain, path, and trailing slash.

Token exchange returns `bad_verification_code`

Authorization codes are short-lived and can be used once. Exchange the code immediately from your backend and avoid retrying the same code after a failed attempt.

The user sees the consent screen again

Pxxl skips consent only when the user has already approved the same app with the same or narrower scope set. If you added a new scope, the user must approve it.

Webhook verification fails

Verify the raw request body, not a parsed or reserialized JSON object. Use `X-Pxxl-Timestamp`, `X-Pxxl-Signature`, and the raw client secret-derived signing key.

## [Security checklist](https://pxxl.app/#security-checklist)

- Keep `client_secret` on your backend.
- Validate `state` before trusting a callback.
- Always verify the webhook signature (`X-Pxxl-Signature`) using the timestamp and client secret.
- Reject webhook payloads if the `X-Pxxl-Timestamp` is older than 5 minutes to prevent replay attacks.
- Use exact HTTPS callback URLs in production.
- Exchange authorization codes immediately; they expire quickly and can be used once.
- Request only the scopes your product needs.

[Circuit breaker, retries, and in-flight limits\\ \\ Protect unhealthy upstreams with route-level retry, circuit breaker, and concurrency controls.](https://pxxl.app/docs/quick-fixes/proxy-upstream-protection) [CDN and Proxy Logs\\ \\ Orchestrate file storage spaces, upload assets via CLI, and analyze real-time proxy traffic and security events.](https://pxxl.app/docs/cdn-proxy)

### On this page

[What You Can Build](https://pxxl.app/#what-you-can-build) [Create an OAuth app](https://pxxl.app/#create-an-oauth-app) [Setup Checklist](https://pxxl.app/#setup-checklist) [Dashboard Management](https://pxxl.app/#dashboard-management) [Scopes](https://pxxl.app/#scopes) [Authorization URL](https://pxxl.app/#authorization-url) [Consent Screen Behavior](https://pxxl.app/#consent-screen-behavior) [Exchange the code](https://pxxl.app/#exchange-the-code) [Read user info](https://pxxl.app/#read-user-info) [OAuth Webhooks](https://pxxl.app/#oauth-webhooks) [Webhook Headers](https://pxxl.app/#webhook-headers) [Event payloads](https://pxxl.app/#event-payloads) [`oauth.authorized`](https://pxxl.app/#oauthauthorized) [`oauth.denied`](https://pxxl.app/#oauthdenied) [`oauth.revoked`](https://pxxl.app/#oauthrevoked) [Signature Verification](https://pxxl.app/#signature-verification) [Repeat consent and automatic bypass](https://pxxl.app/#repeat-consent-and-automatic-bypass) [Troubleshooting OAuth](https://pxxl.app/#troubleshooting-oauth) [Security checklist](https://pxxl.app/#security-checklist)