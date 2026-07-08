# Pxxl Python SDK

Official Python client for Pxxl CDN uploads, domain search and DNS management, cron jobs, and source deploys.

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
