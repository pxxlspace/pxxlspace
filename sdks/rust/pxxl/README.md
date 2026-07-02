# Pxxl Rust SDK

Official Rust client for Pxxl CDN uploads, domain search and DNS management, cron jobs, and source deploys.

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

## Domains

```rust
let search = client.search_domains("example.cv").await?;
let connected = client.connect_domain("example.com", "proj_123", None).await?;
let api_domain = client.connect_domain_to_service("api.example.com", "proj_123", "api", None).await?;
let records = client.list_domain_dns_records("dom_123", None).await?;
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
