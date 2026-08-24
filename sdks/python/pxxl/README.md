# Pxxl Python SDK

Use one Python client for projects, deployments, environment variables, domains,
billing, CDN, Storage, databases, cron jobs, analytics, teams, and MCP.

```bash
pip install pxxl
```

```python
from pxxl import PxxlClient

client = PxxlClient(api_key="pxxl_...")

asset = client.upload_asset(
    file_path="logo.png",
    visibility="public",
)
print(asset["publicUrl"])
```

## Platform services

```python
projects = client.list_projects()
buckets = client.list_storage_buckets()
databases = client.list_databases()
identity = client.whoami()
```

Use `client.request()` for a new API route and `client.mcp_rpc()` for Pxxl MCP tools and resources.

## Domains

```python
search = client.search_domains("example.cv")
connected = client.connect_domain("example.com", project_id="proj_123")
api_domain = client.connect_domain("api.example.com", project_id="proj_123", microservice_id="api")
records = client.list_domain_dns_records("dom_123")
client.resync_domain_proxy("example.com")
client.disconnect_domain("old.example.com", project_id="proj_123")
```

Domain write operations require `scope=domain`, `scope=domains`, or `scope=all` with `permission=read_write`.

## Cron Jobs

```python
job = client.create_cron_job(
    name="cache warmer",
    schedule="*/5 * * * *",
    url="https://example.com/api/warm-cache",
    method="POST",
)
client.trigger_cron_job(job["id"])
```

Cron mutations require `scope=cron`, `scope=cronjobs`, or `scope=all` with `permission=read_write`.

## Deploy

```python
result = client.deploy(
    directory=".",
    name="python-api",
    domain_choice="pxxl.app",
    language="python",
    framework="fastapi",
    start_command="uvicorn main:app --host 0.0.0.0 --port $PORT",
)
print(result["deploymentUrl"])
```

See the [SDK documentation](../../../docs/integrations/sdk/overview.mdx) for every module and the [publishing guide](../../../docs/integrations/sdk/publishing.mdx) for release steps.
