use pxxl::{CreateCronJob, DeployInput, DomainDnsRecord, PxxlClient, UploadAsset};

fn client() -> Result<PxxlClient, pxxl::PxxlError> {
    PxxlClient::new(std::env::var("PXXL_API_KEY").unwrap_or_default())
}

async fn upload_cdn_asset() -> Result<(), pxxl::PxxlError> {
    let asset = client()?
        .upload_asset(UploadAsset {
            file_name: "hello.txt".into(),
            bytes: b"hello from Pxxl".to_vec(),
            visibility: Some("public".into()),
            ..Default::default()
        })
        .await?;
    println!("{:?}", asset.public_url);
    Ok(())
}

async fn search_domain(domain: &str) -> Result<(), pxxl::PxxlError> {
    let search = client()?.search_domains(domain).await?;
    println!("{} results for {}", search.count, search.query);
    Ok(())
}

async fn connect_domain(domain: &str, project_id: &str) -> Result<(), pxxl::PxxlError> {
    let connected = client()?.connect_domain(domain, project_id, None).await?;
    println!("{connected:?}");
    Ok(())
}

async fn resync_domain_proxy(domain: &str) -> Result<(), pxxl::PxxlError> {
    let result = client()?.resync_domain_proxy(domain, None).await?;
    println!("{result:?}");
    Ok(())
}

async fn disconnect_domain(domain: &str, project_id: &str) -> Result<(), pxxl::PxxlError> {
    let result = client()?
        .disconnect_domain(domain, Some(project_id), None)
        .await?;
    println!("{result:?}");
    Ok(())
}

async fn create_dns_record(domain_id: &str) -> Result<(), pxxl::PxxlError> {
    let created = client()?
        .create_domain_dns_record(
            domain_id,
            DomainDnsRecord {
                r#type: Some("A".into()),
                name: Some("@".into()),
                value: Some("193.181.212.65".into()),
                ttl: Some(60),
                ..Default::default()
            },
            None,
        )
        .await?;
    println!("{created:?}");
    Ok(())
}

async fn create_cron_job() -> Result<(), pxxl::PxxlError> {
    let job = client()?
        .create_cron_job(CreateCronJob {
            name: "cache warmer".into(),
            schedule: "*/5 * * * *".into(),
            url: "https://example.com/api/warm-cache".into(),
            method: Some("POST".into()),
            timeout_seconds: Some(10),
            ..Default::default()
        })
        .await?;
    println!("{}", job.id);
    Ok(())
}

async fn deploy_current_directory() -> Result<(), pxxl::PxxlError> {
    let result = client()?
        .deploy(DeployInput {
            directory: Some(".".into()),
            name: Some("rust-sdk-example".into()),
            domain_choice: Some("pxxl.app".into()),
            language: Some("rust".into()),
            framework: Some("axum".into()),
            commit_message: Some("Deploy from Rust SDK".into()),
            ..Default::default()
        })
        .await?;
    println!("{result:?}");
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), pxxl::PxxlError> {
    upload_cdn_asset().await?;
    search_domain("example.cv").await?;
    let _ = connect_domain;
    let _ = create_dns_record;
    let _ = create_cron_job;
    let _ = deploy_current_directory;
    Ok(())
}
