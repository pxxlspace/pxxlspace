# Pxxl Rust SDK

Use `purchase_domain_checkout(...)` to create a domain invoice and its hosted
payment URL in one backend flow. Persist the invoice ID and confirm payment
before provisioning the domain.

Use one Rust client for projects, deployments, environment variables, domains,
billing, CDN, Storage, databases, cron jobs, analytics, teams, and MCP.

```bash
cargo add pxxl
```

```rust
use pxxl::{PxxlClient, UploadAsset};

#[tokio::main]
async fn main() -> Result<(), pxxl::PxxlError> {
    let client = PxxlClient::new(std::env::var("PXXL_API_KEY").unwrap())?;

    let asset = client.upload_asset(UploadAsset {
        file_name: "hello.txt".into(),
        bytes: b"hello from Pxxl".to_vec(),
        visibility: Some("public".into()),
        ..Default::default()
    }).await?;

    println!("{:?}", asset.public_url);
    Ok(())
}
```

## Platform services

```rust
let projects = client.list_projects(None).await?;
let buckets = client.list_storage_buckets().await?;
let databases = client.list_databases(None).await?;
let identity = client.whoami().await?;
```

Use `request_json` for a new API route and `mcp_rpc` for Pxxl MCP tools and resources.

## Domains

```rust
let search = client.search_domains("example.cv").await?;
let connected = client.connect_domain("example.com", "proj_123", None).await?;
let api_domain = client.connect_domain_to_service("api.example.com", "proj_123", "api", None).await?;
let records = client.list_domain_dns_records("dom_123", None).await?;
client.resync_domain_proxy("example.com", None).await?;
client.disconnect_domain("old.example.com", Some("proj_123"), None).await?;
```

## Domain reselling

Sell domains to your own users (Pro plan and up). Use a reseller key from Tools > Domain reseller; purchases are charged to your Pxxl wallet. `.cv` costs ₦6,000 a year.

```rust
let client = pxxl::PxxlClient::new(std::env::var("PXXL_RESELLER_KEY")?)?;
let quote = client.reseller().quote("example.cv", 1).await?;
client.reseller().register(pxxl::ResellerRegisterInput {
    domain: "example.cv".into(),
    customer: Some(serde_json::json!({ "reference": "cust_42" })),
    max_charge_minor: quote["chargeMinor"].as_i64(),
    idempotency_key: Some("order-1001".into()),
    ..Default::default()
}).await?;
client.reseller().set_dns_record("example.cv", serde_json::json!({ "type": "A", "name": "@", "value": "203.0.113.10" })).await?;
```

## Cron Jobs

```rust
let job = client.create_cron_job(CreateCronJob {
    name: "cache warmer".into(),
    schedule: "*/5 * * * *".into(),
    url: "https://example.com/api/warm-cache".into(),
    method: Some("POST".into()),
    ..Default::default()
}).await?;
```

See the [SDK documentation](../../../docs/integrations/sdk/overview.mdx) for every module and the [publishing guide](../../../docs/integrations/sdk/publishing.mdx) for release steps.

## Deploy

```rust
let result = client.deploy(DeployInput {
    directory: Some(".".into()),
    name: Some("rust-api".into()),
    domain_choice: Some("pxxl.app".into()),
    language: Some("rust".into()),
    framework: Some("axum".into()),
    build_command: Some("cargo build --release".into()),
    start_command: Some("./target/release/app".into()),
    ..Default::default()
}).await?;
```
