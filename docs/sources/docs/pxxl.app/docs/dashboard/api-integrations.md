# Source: https://pxxl.app/docs/dashboard/api-integrations

Dashboard

# API Keys

Create scoped API keys from the Pxxl dashboard and link to OAuth integration setup.

Use API keys when a trusted backend service needs to talk to Pxxl directly. Use [OAuth Integrations](https://pxxl.app/docs/integrations/oauth) when another app needs a signed-in user to approve access.

## [API Keys](https://pxxl.app/#api-keys)

Open **Dashboard > API Keys** to manage platform tokens.

![API keys page](https://cdn.pxxl.app/docs/dashboard-screenshots/37-api-keys-page.png)

Click **Create API Key** or **New API Key** to open the key form.

![API key create form](https://cdn.pxxl.app/docs/dashboard-screenshots/38-api-key-create-form.png)

| Field | Use |
| --- | --- |
| **Key name** | A readable label such as `Production deploy bot`, `CDN uploader`, or `Internal monitor`. |
| **Description** | Optional context explaining where the key is used. |
| **Scopes / permissions** | Restrict the token to the minimum capabilities needed. |
| **Expiration** | Rotate keys regularly and avoid permanent tokens where possible. |

Common key patterns:

| Workflow | Recommended scope pattern |
| --- | --- |
| Backend deployment checks | Read deployment and project status only. |
| CDN uploader | CDN asset upload and read permissions. |
| Internal automation | Narrow project, domain, or billing scopes for that automation. |
| Monitoring service | Read-only status and usage permissions. |

Never put API keys in browser JavaScript. Store them in backend secrets or project environment variables, give each automation its own key, rotate keys when ownership changes, and delete unused keys.

## [OAuth apps](https://pxxl.app/#oauth-apps)

OAuth apps are managed from **Dashboard > Integrations**, but their full guide is separate so the dashboard docs stay focused on dashboard navigation. Open [OAuth Integrations](https://pxxl.app/docs/integrations/oauth) for app setup, callback URLs, scopes, token exchange, user info, signed webhooks, connected apps, and troubleshooting.

[Settings, Usage, And Webhooks\\ \\ Use dashboard settings tabs, usage reports, invoices, notifications, customization, and signed webhooks.](https://pxxl.app/docs/dashboard/settings-usage-webhooks) [Deployment Reference\\ \\ Complete reference for configuring install, build, and execution commands across Node.js, Python, Go, PHP, Java, and monorepo architectures.](https://pxxl.app/docs/deployment)

### On this page

[API Keys](https://pxxl.app/#api-keys) [OAuth apps](https://pxxl.app/#oauth-apps)