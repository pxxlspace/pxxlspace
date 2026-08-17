# Source: https://pxxl.app/docs/quick-fixes/oauth-callback

Quick Fixes

# OAuth callback fails or returns to the wrong URL

Match OAuth callback URLs, redirect URIs, HTTPS, and allowlists.

OAuth callback fails or returns to the wrong URL

Share this fix or copy it as Markdown for an LLM.

Share linkCopy as Markdown

The callback URL and redirect URI must match the OAuth app settings exactly.

## [Check](https://pxxl.app/#check)

- The `redirect_uri` in the authorization URL.
- The callback URL stored on the OAuth app.
- The redirect URI allowlist.
- Whether the URL uses `https://`.
- Whether there is a trailing slash mismatch.

For the full setup guide, open [OAuth Integrations](https://pxxl.app/docs/integrations/oauth).

[Database is not visible inside a project\\ \\ Attach a database as a sub service and pass its connection URL into the project environment.](https://pxxl.app/docs/quick-fixes/database-not-visible) [OAuth bad verification code\\ \\ Fix expired, reused, or mismatched authorization codes.](https://pxxl.app/docs/quick-fixes/oauth-bad-verification-code)

### On this page

[Check](https://pxxl.app/#check)