# Source: https://pxxl.app/docs/github-previews

# GitHub Webhooks and Preview Deployments

Set up automated, branch-aware code deployments and configure ephemeral pull request environments.

Pxxl integrates with your GitHub repository to automate deployments based on repository commits and pull request events.

---

## [Branch-Aware Commit Routing](https://pxxl.app/#branch-aware-commit-routing)

When a commit is pushed to your GitHub repository, the Pxxl webhook handler intercepts the payload and routes it according to these rules:

1. **Signature Verification:** The payload header signature (`X-Hub-Signature-256`) is verified against the webhook secret registered in your GitHub repository.
2. **Target Extraction:** Pxxl extracts the repository name and target branch ref from the push event.
3. **Project Matching:** The control plane looks up projects associated with that repository and branch.
4. **Selective Deployment:** If **Auto Deploy** is enabled for the matched project, a new build task is enqueued. Commits to other branches do not trigger builds for this project, preventing unexpected deployments.

---

## [Pull Request Previews](https://pxxl.app/#pull-request-previews)

Deploy previews are temporary, isolated environments created automatically when a developer opens a pull request. This allows teams to verify changes in a live environment before merging to the production branch.

### [Supported Hook Activities](https://pxxl.app/#supported-hook-activities)

Pxxl listens for these pull request events:

- `opened`: Provisions a new isolated environment and maps a temporary preview URL.
- `synchronize`: Triggered when new commits are pushed to the pull request source branch. The preview is rebuilt and redeployed.
- `reopened`: Restarts the preview environment or creates a new one.
- `closed`: Shuts down the environment, deletes associated routes, and releases environment resources.

---

## [Preview Lifecycles and Expiry](https://pxxl.app/#preview-lifecycles-and-expiry)

Preview deployments are designed to be temporary to preserve server resources:

```
PR Created ──► Preview Environment Deployed ──► Live URL Mapped
                                                    │
                 ┌──────────────────────────────────┴──────────────────┐
                 ▼                                                     ▼
        PR Closed / Merged                                      72 Hours Elapsed
                 │                                                     │
                 ▼                                                     ▼
     Environment Stopped & Deleted                             Cleanup Worker Runs
```

- **Manual Closure:** When the pull request is merged or closed on GitHub, the Pxxl webhook agent terminates the environment immediately.
- **Automatic Expiry:** If a pull request remains open for **72 hours**, a background cleanup worker stops the environment and marks the preview state as expired.

---

## [Preview Metadata Payload](https://pxxl.app/#preview-metadata-payload)

You can query the active deployment metadata using the platform API:

```
{
  "preview": {
    "enabled": true,
    "kind": "pull_request",
    "branch": "feature/refactor-auth",
    "sha": "d3b07384d113edec49eaa6238ad5ff00",
    "pullRequestNumber": 142,
    "expiresAt": "2026-05-29T12:00:00Z"
  }
}
```

---

## [Setting Up Previews](https://pxxl.app/#setting-up-previews)

To enable previews for your project:

1. Navigate to your project settings page in the dashboard.
2. Select the **Deploy Settings** tab.
3. Enable the **Pull Request Previews** toggle.
4. Specify the target base branch (typically `main` or `master`) that previews should watch.
5. Save your settings.
6. Open a test pull request against your base branch on GitHub to trigger the initial preview build.

[CDN and Proxy Logs\\ \\ Orchestrate file storage spaces, upload assets via CLI, and analyze real-time proxy traffic and security events.](https://pxxl.app/docs/cdn-proxy) [API Keys and Platform API\\ \\ Create scoped API keys, authenticate backend requests, upload CDN files, and connect automation safely.](https://pxxl.app/docs/api)

### On this page

[Branch-Aware Commit Routing](https://pxxl.app/#branch-aware-commit-routing) [Pull Request Previews](https://pxxl.app/#pull-request-previews) [Supported Hook Activities](https://pxxl.app/#supported-hook-activities) [Preview Lifecycles and Expiry](https://pxxl.app/#preview-lifecycles-and-expiry) [Preview Metadata Payload](https://pxxl.app/#preview-metadata-payload) [Setting Up Previews](https://pxxl.app/#setting-up-previews)