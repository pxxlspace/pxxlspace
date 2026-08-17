# Source: https://pxxl.app/docs/quick-fixes/oauth-bad-verification-code

Quick Fixes

# OAuth bad verification code

Fix expired, reused, or mismatched authorization codes.

OAuth bad verification code

Share this fix or copy it as Markdown for an LLM.

Share linkCopy as Markdown

Authorization codes expire quickly and can be used once. Exchange the code from your backend immediately after the callback lands.

## [Do Not](https://pxxl.app/#do-not)

- Exchange from browser JavaScript.
- Retry the same code after a failed exchange.
- Reuse a code after a page refresh.
- Use a different redirect URI during token exchange than the one used for authorization.

[OAuth callback fails or returns to the wrong URL\\ \\ Match OAuth callback URLs, redirect URIs, HTTPS, and allowlists.](https://pxxl.app/docs/quick-fixes/oauth-callback) [After buying a domain on Pxxl\\ \\ Finish registration, DNS, project connection, proxy resync, and SSL coverage.](https://pxxl.app/docs/quick-fixes/after-buying-domain)

### On this page

[Do Not](https://pxxl.app/#do-not)