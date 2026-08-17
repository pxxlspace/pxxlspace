# Source: https://pxxl.app/docs/dashboard/settings-usage-webhooks

Dashboard

# Settings, Usage, And Webhooks

Use dashboard settings tabs, usage reports, invoices, notifications, customization, and signed webhooks.

This page covers workspace-wide controls. Before changing anything here, confirm the active workspace in the top switcher.

![Dashboard workspace switcher](https://cdn.pxxl.app/docs/dashboard-screenshots/dashboard-top-switcher.png)

## [Usage](https://pxxl.app/#usage)

Open **Dashboard > Usage** when you need to understand how the workspace is consuming resources.

![Usage dashboard page](https://cdn.pxxl.app/docs/dashboard-screenshots/11-usage.png)

| Area | What to review |
| --- | --- |
| **Artifact storage** | How much deployment/build artifact storage is used against the current limit. |
| **Project usage** | Which projects are using the most resources. Use this before cleanup, optimization, or plan changes. |
| **Recent deployments** | Recent build activity and whether deployments are frequent enough to affect usage. |
| **Activity chart** | Project creation, deletion, deployment, and webhook activity over time. |
| **Usage limits** | Whether the workspace is approaching a plan, credit, storage, or traffic limit. |

Use this page before deleting artifacts, changing plans, investigating unexpected activity, or explaining a billing change.

## [Invoices And Billing](https://pxxl.app/#invoices-and-billing)

Open **Dashboard > Invoices** for billing records, then open **Settings > Billing** for account-level billing controls.

![Invoices dashboard page](https://cdn.pxxl.app/docs/dashboard-screenshots/12-invoices.png) ![Settings billing tab](https://cdn.pxxl.app/docs/dashboard-screenshots/settings-billing.png)

Use invoices for payment history and billing status. Use the billing settings tab for plan, payment, and subscription-related controls shown in the dashboard.

## [Settings Tabs](https://pxxl.app/#settings-tabs)

Open **Dashboard > Settings** to manage account and workspace preferences.

![Settings profile tab](https://cdn.pxxl.app/docs/dashboard-screenshots/settings-profile.png)

| Tab | What it is for |
| --- | --- |
| **Profile** | Name, email-facing profile details, and account identity shown inside the dashboard. |
| **GitHub** | Connected GitHub account, repository access state, and reconnect/disconnect actions. |
| **Projects** | Workspace-level project preferences and project defaults. |
| **Connected Apps** | OAuth applications or external apps that currently have access to the account. |
| **Security** | Password, two-factor or device security controls, and sensitive account protection. |
| **Billing** | Plan, payment, subscription, and billing controls. |
| **Login History** | Recent sign-in records for security review. |
| **Notifications** | Email or dashboard notification preferences. |
| **Customization** | Workspace appearance or dashboard preference controls. |
| **Webhooks** | Signed event delivery for project, deployment, environment, and profile activity. |

## [GitHub](https://pxxl.app/#github)

![Settings GitHub tab](https://cdn.pxxl.app/docs/dashboard-screenshots/settings-github.png)

Use **GitHub** when repository imports or automatic deployments are not behaving as expected. Reconnect only when you intentionally need to refresh permissions.

## [Projects](https://pxxl.app/#projects)

![Settings projects tab](https://cdn.pxxl.app/docs/dashboard-screenshots/settings-projects.png)

Use **Projects** for workspace-level project behavior. Project-specific runtime settings still live under **Projects > project > Settings**.

## [Connected Apps](https://pxxl.app/#connected-apps)

![Settings connected apps tab](https://cdn.pxxl.app/docs/dashboard-screenshots/settings-connected-apps.png)

Use **Connected Apps** to review apps you authorized. Revoke apps you no longer use or do not recognize.

## [Security And Login History](https://pxxl.app/#security-and-login-history)

![Settings security tab](https://cdn.pxxl.app/docs/dashboard-screenshots/settings-security.png) ![Settings login history tab](https://cdn.pxxl.app/docs/dashboard-screenshots/settings-login-history.png)

Use **Security** before changing passwords, authentication methods, or device protections. Use **Login History** to investigate unfamiliar access.

## [Notifications And Customization](https://pxxl.app/#notifications-and-customization)

![Settings notifications tab](https://cdn.pxxl.app/docs/dashboard-screenshots/settings-notifications.png) ![Settings customization tab](https://cdn.pxxl.app/docs/dashboard-screenshots/settings-customization.png)

Use **Notifications** to control what the dashboard sends you. Use **Customization** for personal or workspace presentation preferences.

## [Webhooks](https://pxxl.app/#webhooks)

![Settings webhooks tab](https://cdn.pxxl.app/docs/dashboard-screenshots/settings-webhooks.png)

Use **Webhooks** to send signed dashboard events to your backend.

| Control | What it does |
| --- | --- |
| **Enable Webhook** | Turns event delivery on or off for the account/workspace. |
| **Webhook URL** | The HTTPS endpoint that receives event POST requests. |
| **Event subscriptions** | Lets you choose which events to send. |
| **Signing secret** | Used by your backend to verify that requests came from Pxxl. |
| **Save Webhook** | Persists the URL, subscriptions, and enabled state. |

Webhook events shown in the settings tab include project created, project updated, project deleted, deployment created, redeployment queued, GitHub deployment, deployment status changed, environment updated, and user profile updated.

Every webhook request includes headers such as `X-Pxxl-Event`, `X-Pxxl-Action-Type`, `X-Pxxl-Timestamp`, and `X-Pxxl-Signature`. Your backend should verify the signature, reject stale timestamps, and return a successful HTTP response only after the event is accepted.

## [Safe Update Pattern](https://pxxl.app/#safe-update-pattern)

1. Confirm the active workspace in the top switcher.
2. Open the relevant settings tab.
3. Read the current value before changing it.
4. For webhooks, test your endpoint from your backend before enabling important events.
5. Save only when the URL, subscription list, and security settings are correct.

[Database\\ \\ Create managed databases from the dashboard, link them to projects, and expose the right connection values to your running containers.](https://pxxl.app/docs/dashboard/database) [API Keys\\ \\ Create scoped API keys from the Pxxl dashboard and link to OAuth integration setup.](https://pxxl.app/docs/dashboard/api-integrations)

### On this page

[Usage](https://pxxl.app/#usage) [Invoices And Billing](https://pxxl.app/#invoices-and-billing) [Settings Tabs](https://pxxl.app/#settings-tabs) [GitHub](https://pxxl.app/#github) [Projects](https://pxxl.app/#projects) [Connected Apps](https://pxxl.app/#connected-apps) [Security And Login History](https://pxxl.app/#security-and-login-history) [Notifications And Customization](https://pxxl.app/#notifications-and-customization) [Webhooks](https://pxxl.app/#webhooks) [Safe Update Pattern](https://pxxl.app/#safe-update-pattern)