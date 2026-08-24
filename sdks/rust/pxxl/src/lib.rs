use reqwest::{multipart, Client, Method};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::{Cursor, Write};
use std::path::{Path, PathBuf};
use thiserror::Error;
use walkdir::WalkDir;
use zip::write::FileOptions;

pub const PXXL_API_BASE_URL: &str = "https://server.pxxl.app/api/v3";
pub const PXXL_MCP_ENDPOINT: &str = "https://mcp.pxxl.app/mcp";
pub const PXXL_MCP_PROTOCOL_VERSION: &str = "2025-06-18";
pub const MAX_DEPLOY_FILES: usize = 12_000;
pub const MAX_DEPLOY_SOURCE_BYTES: u64 = 220 * 1024 * 1024;

#[derive(Debug, Error)]
pub enum PxxlError {
    #[error("pxxl: api key is required")]
    MissingApiKey,
    #[error("pxxl: request failed with {status}: {message}")]
    Api {
        status: u16,
        message: String,
        body: String,
    },
    #[error("pxxl: http error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("pxxl: io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("pxxl: zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("pxxl: {0}")]
    InvalidInput(String),
}

#[derive(Clone)]
pub struct PxxlClient {
    api_key: String,
    team_id: Option<String>,
    base_url: String,
    http: Client,
}

impl PxxlClient {
    pub fn new(api_key: impl Into<String>) -> Result<Self, PxxlError> {
        let api_key = api_key.into().trim().to_string();
        if api_key.is_empty() {
            return Err(PxxlError::MissingApiKey);
        }
        Ok(Self {
            api_key,
            team_id: None,
            base_url: PXXL_API_BASE_URL.to_string(),
            http: Client::new(),
        })
    }

    pub fn with_team_id(mut self, team_id: impl Into<String>) -> Self {
        let team_id = team_id.into().trim().to_string();
        if !team_id.is_empty() {
            self.team_id = Some(team_id);
        }
        self
    }

    pub fn with_base_url(mut self, base_url: impl Into<String>) -> Self {
        let base_url = base_url.into().trim().trim_end_matches('/').to_string();
        if !base_url.is_empty() {
            self.base_url = base_url;
        }
        self
    }

    pub async fn summary(&self) -> Result<CdnSummary, PxxlError> {
        let body: Value = self.request(Method::GET, "/cdn/summary", None).await?;
        serde_json::from_value(body["data"].clone())
            .map_err(|error| PxxlError::InvalidInput(error.to_string()))
    }

    pub async fn list_assets(&self, query: Option<&[(&str, &str)]>) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/cdn/assets{}", query_string(query)),
            None,
        )
        .await
    }

    pub async fn upload_asset(&self, input: UploadAsset) -> Result<CdnAsset, PxxlError> {
        if input.file_name.trim().is_empty() {
            return Err(PxxlError::InvalidInput(
                "upload file_name is required".into(),
            ));
        }
        let mut form = multipart::Form::new()
            .part(
                "file",
                multipart::Part::bytes(input.bytes).file_name(input.file_name),
            )
            .text(
                "visibility",
                input.visibility.unwrap_or_else(|| "public".into()),
            )
            .text("kind", input.kind.unwrap_or_else(|| "file".into()));
        if let Some(project_id) = input.project_id {
            form = form.text("projectId", project_id);
        }
        if let Some(deployment_id) = input.deployment_id {
            form = form.text("deploymentId", deployment_id);
        }
        if let Some(bucket_id) = input.bucket_id {
            form = form.text("bucketId", bucket_id);
        }
        self.multipart("/cdn/assets", form).await
    }

    pub async fn download_asset(&self, id: &str) -> Result<Vec<u8>, PxxlError> {
        self.raw(
            Method::GET,
            &format!("/cdn/assets/{}/download", escape(id)),
            None,
        )
        .await
    }

    pub async fn delete_asset(&self, id: &str) -> Result<(), PxxlError> {
        let _: Value = self
            .request(Method::DELETE, &format!("/cdn/assets/{}", escape(id)), None)
            .await?;
        Ok(())
    }

    pub async fn list_tlds(&self) -> Result<Value, PxxlError> {
        self.request(Method::GET, "/domains/tlds", None).await
    }

    pub async fn popular_tlds(&self) -> Result<Value, PxxlError> {
        self.request(Method::GET, "/domains/tlds/popular", None)
            .await
    }

    pub async fn search_tlds(&self, query: &str) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/domains/tlds/search?q={}", escape(query)),
            None,
        )
        .await
    }

    pub async fn search_domains(&self, query: &str) -> Result<DomainSearchResponse, PxxlError> {
        self.request(
            Method::POST,
            "/domains/search",
            Some(json!({ "query": query })),
        )
        .await
    }

    pub async fn list_domains(&self, team_id: Option<&str>) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/cli/domains{}", self.team_query(team_id)),
            None,
        )
        .await
    }

    pub async fn check_domain(
        &self,
        domain: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!(
                "/cli/domains/{}/check{}",
                escape(domain),
                self.team_query(team_id)
            ),
            None,
        )
        .await
    }

    pub async fn connect_domain(
        &self,
        domain: &str,
        project_id: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::POST,
            &format!("/cli/domains{}", self.team_query(team_id)),
            Some(json!({ "domain": domain, "projectId": project_id })),
        )
        .await
    }

    pub async fn connect_domain_to_service(
        &self,
        domain: &str,
        project_id: &str,
        service_alias: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::POST,
            &format!("/cli/domains{}", self.team_query(team_id)),
            Some(json!({
                "domain": domain,
                "projectId": project_id,
                "serviceAlias": service_alias
            })),
        )
        .await
    }

    pub async fn verify_domain_record(
        &self,
        input: VerifyDomainRecord,
    ) -> Result<Value, PxxlError> {
        let team = input.team_id.as_deref();
        self.request(
            Method::POST,
            &format!("/cli/domains/checkrecord{}", self.team_query(team)),
            Some(serde_json::to_value(input).unwrap()),
        )
        .await
    }

    pub async fn verify_domain_dns_record(
        &self,
        input: VerifyDomainRecord,
    ) -> Result<Value, PxxlError> {
        self.verify_domain_record(input).await
    }

    pub async fn get_domain(&self, id: &str, team_id: Option<&str>) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/cli/domains/{}{}", escape(id), self.team_query(team_id)),
            None,
        )
        .await
    }

    pub async fn disconnect_domain(
        &self,
        domain: &str,
        project_id: Option<&str>,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        let mut query = Vec::new();
        if let Some(project_id) = project_id.filter(|value| !value.trim().is_empty()) {
            query.push(format!("projectId={}", escape(project_id)));
        }
        if let Some(team_id) = team_id.filter(|value| !value.trim().is_empty()) {
            query.push(format!("teamId={}", escape(team_id)));
        }
        let suffix = if query.is_empty() {
            String::new()
        } else {
            format!("?{}", query.join("&"))
        };
        self.request(
            Method::DELETE,
            &format!("/cli/domains/{}{}", escape(domain), suffix),
            None,
        )
        .await
    }

    pub async fn resync_domain_proxy(
        &self,
        domain: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::POST,
            &format!(
                "/cli/domains/{}/resync{}",
                escape(domain),
                self.team_query(team_id)
            ),
            Some(json!({})),
        )
        .await
    }

    pub async fn list_domain_dns_records(
        &self,
        id: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!(
                "/cli/domains/{}/dns-records{}",
                escape(id),
                self.team_query(team_id)
            ),
            None,
        )
        .await
    }

    pub async fn create_domain_dns_record(
        &self,
        id: &str,
        record: DomainDnsRecord,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::POST,
            &format!(
                "/cli/domains/{}/dns-records{}",
                escape(id),
                self.team_query(team_id)
            ),
            Some(serde_json::to_value(record).unwrap()),
        )
        .await
    }

    pub async fn update_domain_dns_records(
        &self,
        id: &str,
        record: DomainDnsRecord,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::PUT,
            &format!(
                "/cli/domains/{}/dns-records{}",
                escape(id),
                self.team_query(team_id)
            ),
            Some(serde_json::to_value(record).unwrap()),
        )
        .await
    }

    pub async fn delete_domain_dns_record(
        &self,
        id: &str,
        record: DomainDnsRecord,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::DELETE,
            &format!(
                "/cli/domains/{}/dns-records{}",
                escape(id),
                self.team_query(team_id)
            ),
            Some(serde_json::to_value(record).unwrap()),
        )
        .await
    }

    pub async fn activate_domain(
        &self,
        id: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::POST,
            &format!(
                "/cli/domains/{}/activate{}",
                escape(id),
                self.team_query(team_id)
            ),
            Some(json!({})),
        )
        .await
    }

    pub async fn domain_zone_status(
        &self,
        id: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.domain_connection_status(id, team_id).await
    }

    pub async fn domain_connection_status(
        &self,
        id: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        let domain = self.get_domain(id, team_id).await?;
        if is_cv_domain_name(&domain_name_from_value(&domain)) {
            match self.domain_zone_status_raw(id, team_id).await {
                Ok(value) => return Ok(value),
                Err(error) if is_cv_zone_only_error(&error) => {}
                Err(error) => return Err(error),
            }
        }
        self.activate_domain(id, team_id).await
    }

    async fn domain_zone_status_raw(
        &self,
        id: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!(
                "/cli/domains/{}/zone-status{}",
                escape(id),
                self.team_query(team_id)
            ),
            None,
        )
        .await
    }

    pub async fn download_domain_certificate(
        &self,
        id: &str,
        team_id: Option<&str>,
    ) -> Result<Vec<u8>, PxxlError> {
        self.raw(
            Method::GET,
            &format!(
                "/cli/domains/{}/certificate/download{}",
                escape(id),
                self.team_query(team_id)
            ),
            None,
        )
        .await
    }

    pub async fn list_cron_jobs(&self, team_id: Option<&str>) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/cli/cronjobs{}", self.team_query(team_id)),
            None,
        )
        .await
    }

    pub async fn create_cron_job(&self, input: CreateCronJob) -> Result<CronJob, PxxlError> {
        let team = input.team_id.as_deref();
        self.request(
            Method::POST,
            &format!("/cli/cronjobs{}", self.team_query(team)),
            Some(serde_json::to_value(input).unwrap()),
        )
        .await
    }

    pub async fn get_cron_job(
        &self,
        id: &str,
        team_id: Option<&str>,
    ) -> Result<CronJob, PxxlError> {
        self.request(
            Method::GET,
            &format!("/cli/cronjobs/{}{}", escape(id), self.team_query(team_id)),
            None,
        )
        .await
    }

    pub async fn trigger_cron_job(
        &self,
        id: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.cron_action(id, "trigger", team_id).await
    }

    pub async fn start_cron_job(
        &self,
        id: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.cron_action(id, "start", team_id).await
    }

    pub async fn stop_cron_job(&self, id: &str, team_id: Option<&str>) -> Result<Value, PxxlError> {
        self.cron_action(id, "stop", team_id).await
    }

    pub async fn list_cron_job_runs(
        &self,
        id: &str,
        query: Option<&[(&str, &str)]>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/cli/cronjobs/{}/runs{}", escape(id), query_string(query)),
            None,
        )
        .await
    }

    pub async fn validate_cron_schedule(&self, schedule: &str) -> Result<Value, PxxlError> {
        self.request(
            Method::POST,
            "/cli/cronjobs/validate-schedule",
            Some(json!({ "schedule": schedule })),
        )
        .await
    }

    pub async fn validate_cron_url(&self, url: &str) -> Result<Value, PxxlError> {
        self.request(
            Method::POST,
            "/cli/cronjobs/validate-url",
            Some(json!({ "url": url })),
        )
        .await
    }

    pub async fn deploy(&self, input: DeployInput) -> Result<Value, PxxlError> {
        let bytes = if let Some(path) = &input.archive_path {
            tokio::fs::read(path).await?
        } else {
            create_project_zip(input.directory.as_deref().unwrap_or(Path::new(".")))?
        };
        let file_name = input
            .archive_path
            .as_ref()
            .and_then(|p| p.file_name())
            .and_then(|p| p.to_str())
            .unwrap_or("pxxl-source.zip");
        let mut form = multipart::Form::new()
            .part(
                "file",
                multipart::Part::bytes(bytes).file_name(file_name.to_string()),
            )
            .text(
                "environment",
                input.environment.unwrap_or_else(|| "production".into()),
            )
            .text("sourceShape", "clideploy")
            .text("deploymentSource", "clideploy");
        form = add_text(form, "name", input.name);
        form = add_text(form, "projectId", input.project_id);
        form = add_text(form, "domainChoice", input.domain_choice);
        form = add_text(form, "language", input.language);
        form = add_text(form, "framework", input.framework);
        form = add_text(form, "packageManager", input.package_manager);
        form = add_text(form, "installCommand", input.install_command);
        form = add_text(form, "buildCommand", input.build_command);
        form = add_text(form, "startCommand", input.start_command);
        form = add_text(form, "commitMessage", input.commit_message);
        self.multipart("/projects/spacedrop", form).await
    }

    async fn cron_action(
        &self,
        id: &str,
        action: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::POST,
            &format!(
                "/cli/cronjobs/{}/{}{}",
                escape(id),
                action,
                self.team_query(team_id)
            ),
            Some(json!({})),
        )
        .await
    }

    async fn request<T: for<'de> Deserialize<'de>>(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
    ) -> Result<T, PxxlError> {
        let bytes = self.raw(method, path, body).await?;
        serde_json::from_slice(&bytes).map_err(|error| PxxlError::InvalidInput(error.to_string()))
    }

    async fn raw(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
    ) -> Result<Vec<u8>, PxxlError> {
        let url = format!("{}{}", self.base_url, path);
        let mut req = self
            .http
            .request(method, url)
            .bearer_auth(&self.api_key)
            .header("User-Agent", "pxxl-rust-sdk/0.1");
        if let Some(body) = body {
            req = req.json(&body);
        }
        let resp = req.send().await?;
        let status = resp.status();
        let bytes = resp.bytes().await?.to_vec();
        if !status.is_success() {
            let message = serde_json::from_slice::<Value>(&bytes)
                .ok()
                .and_then(|v| {
                    v.get("message")
                        .or_else(|| v.get("error"))
                        .and_then(|m| m.as_str())
                        .map(ToOwned::to_owned)
                })
                .unwrap_or_else(|| status.to_string());
            return Err(PxxlError::Api {
                status: status.as_u16(),
                message,
                body: String::from_utf8_lossy(&bytes).into_owned(),
            });
        }
        Ok(bytes)
    }

    async fn multipart<T: for<'de> Deserialize<'de>>(
        &self,
        path: &str,
        form: multipart::Form,
    ) -> Result<T, PxxlError> {
        let resp = self
            .http
            .post(format!("{}{}", self.base_url, path))
            .bearer_auth(&self.api_key)
            .header("User-Agent", "pxxl-rust-sdk/0.1")
            .multipart(form)
            .send()
            .await?;
        let status = resp.status();
        let bytes = resp.bytes().await?.to_vec();
        if !status.is_success() {
            let message = serde_json::from_slice::<Value>(&bytes)
                .ok()
                .and_then(|v| {
                    v.get("message")
                        .or_else(|| v.get("error"))
                        .and_then(|m| m.as_str())
                        .map(ToOwned::to_owned)
                })
                .unwrap_or_else(|| status.to_string());
            return Err(PxxlError::Api {
                status: status.as_u16(),
                message,
                body: String::from_utf8_lossy(&bytes).into_owned(),
            });
        }
        serde_json::from_slice(&bytes).map_err(|error| PxxlError::InvalidInput(error.to_string()))
    }

    fn team_query(&self, team_id: Option<&str>) -> String {
        let selected = team_id.or(self.team_id.as_deref()).unwrap_or("").trim();
        if selected.is_empty() {
            String::new()
        } else {
            format!("?teamId={}", escape(selected))
        }
    }
}

impl PxxlClient {
    /// Call any Pxxl API route with this client's authentication.
    pub async fn request_json(
        &self,
        method: &str,
        path: &str,
        body: Option<Value>,
    ) -> Result<Value, PxxlError> {
        if !path.starts_with('/') {
            return Err(PxxlError::InvalidInput(
                "request path must start with /".into(),
            ));
        }
        let method = Method::from_bytes(method.as_bytes())
            .map_err(|error| PxxlError::InvalidInput(error.to_string()))?;
        self.request(method, path, body).await
    }

    pub async fn whoami(&self) -> Result<Value, PxxlError> {
        self.request(Method::GET, "/cli/whoami", None).await
    }

    pub async fn stats(&self, team_id: Option<&str>) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/cli/stats{}", self.team_query(team_id)),
            None,
        )
        .await
    }

    pub async fn platform_usage(&self, team_id: Option<&str>) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/cli/usage{}", self.team_query(team_id)),
            None,
        )
        .await
    }

    pub async fn get_cdn_space(&self) -> Result<Value, PxxlError> {
        self.request(Method::GET, "/cdn/space", None).await
    }

    pub async fn create_cdn_space(&self, name: Option<&str>) -> Result<Value, PxxlError> {
        self.request(Method::POST, "/cdn/space", Some(json!({ "name": name })))
            .await
    }

    pub async fn cdn_usage(&self, limit: usize) -> Result<Value, PxxlError> {
        self.request(Method::GET, &format!("/cdn/usage?limit={limit}"), None)
            .await
    }

    pub async fn cdn_proxy_logs(&self, query: Option<&[(&str, &str)]>) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/cdn/proxy-logs{}", query_string(query)),
            None,
        )
        .await
    }

    pub async fn list_edge_functions(
        &self,
        query: Option<&[(&str, &str)]>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/cdn/edge-functions{}", query_string(query)),
            None,
        )
        .await
    }

    pub async fn create_edge_function(&self, input: Value) -> Result<Value, PxxlError> {
        self.request(Method::POST, "/cdn/edge-functions", Some(input))
            .await
    }

    pub async fn list_storage_buckets(&self) -> Result<Value, PxxlError> {
        self.request(Method::GET, "/storage/buckets", None).await
    }

    pub async fn get_storage_bucket(&self, id: &str) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/storage/buckets/{}", escape(id)),
            None,
        )
        .await
    }

    pub async fn create_storage_bucket(&self, input: Value) -> Result<Value, PxxlError> {
        self.request(Method::POST, "/storage/buckets", Some(input))
            .await
    }

    pub async fn update_storage_bucket(&self, id: &str, input: Value) -> Result<Value, PxxlError> {
        self.request(
            Method::PATCH,
            &format!("/storage/buckets/{}", escape(id)),
            Some(input),
        )
        .await
    }

    pub async fn delete_storage_bucket(&self, id: &str) -> Result<(), PxxlError> {
        self.raw(
            Method::DELETE,
            &format!("/storage/buckets/{}", escape(id)),
            None,
        )
        .await?;
        Ok(())
    }

    pub async fn storage_analytics(&self, id: &str, timeframe: &str) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!(
                "/storage/buckets/{}/analytics?timeframe={}",
                escape(id),
                escape(timeframe)
            ),
            None,
        )
        .await
    }

    pub async fn storage_billing(
        &self,
        query: Option<&[(&str, &str)]>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/storage/billing{}", query_string(query)),
            None,
        )
        .await
    }

    pub async fn list_storage_access_keys(&self, bucket_id: &str) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/storage/buckets/{}/access-keys", escape(bucket_id)),
            None,
        )
        .await
    }

    pub async fn create_storage_access_key(
        &self,
        bucket_id: &str,
        input: Value,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::POST,
            &format!("/storage/buckets/{}/access-keys", escape(bucket_id)),
            Some(input),
        )
        .await
    }

    pub async fn delete_storage_access_key(
        &self,
        bucket_id: &str,
        key_id: &str,
    ) -> Result<(), PxxlError> {
        self.raw(
            Method::DELETE,
            &format!(
                "/storage/buckets/{}/access-keys/{}",
                escape(bucket_id),
                escape(key_id)
            ),
            None,
        )
        .await?;
        Ok(())
    }

    pub async fn project_traffic(
        &self,
        project_id: &str,
        query: Option<&[(&str, &str)]>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!(
                "/projects/{}/analytics/traffic{}",
                escape(project_id),
                query_string(query)
            ),
            None,
        )
        .await
    }

    pub async fn domain_traffic(
        &self,
        domain_id: &str,
        query: Option<&[(&str, &str)]>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!(
                "/domains/my/{}/analytics{}",
                escape(domain_id),
                query_string(query)
            ),
            None,
        )
        .await
    }

    pub async fn user_domain_traffic(
        &self,
        domain: &str,
        timeframe: &str,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!(
                "/user/analytics{}",
                query_string(Some(&[("domain", domain), ("timeframe", timeframe)]))
            ),
            None,
        )
        .await
    }

    pub async fn get_tld(&self, tld: &str) -> Result<Value, PxxlError> {
        self.request(Method::GET, &format!("/domains/tlds/{}", escape(tld)), None)
            .await
    }

    pub async fn list_tld_types(&self) -> Result<Value, PxxlError> {
        self.request(Method::GET, "/domains/types", None).await
    }

    pub async fn list_tlds_by_type(&self, kind: &str) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/domains/types/{}/tlds", escape(kind)),
            None,
        )
        .await
    }

    pub async fn check_domain_availability(&self, domain: &str) -> Result<Value, PxxlError> {
        self.request(
            Method::POST,
            "/domains/check-availability",
            Some(json!({ "domain": domain })),
        )
        .await
    }

    pub async fn create_customer(&self, input: Value) -> Result<Value, PxxlError> {
        self.request(Method::POST, "/cli/contacts", Some(input))
            .await
    }

    pub async fn list_customers(&self) -> Result<Value, PxxlError> {
        self.request(Method::GET, "/cli/contacts", None).await
    }

    pub async fn get_customer(&self, id: &str) -> Result<Value, PxxlError> {
        self.request(Method::GET, &format!("/cli/contacts/{}", escape(id)), None)
            .await
    }

    pub async fn update_customer(&self, id: &str, input: Value) -> Result<Value, PxxlError> {
        self.request(
            Method::PUT,
            &format!("/cli/contacts/{}", escape(id)),
            Some(input),
        )
        .await
    }

    pub async fn delete_customer(&self, id: &str) -> Result<(), PxxlError> {
        self.raw(
            Method::DELETE,
            &format!("/cli/contacts/{}", escape(id)),
            None,
        )
        .await?;
        Ok(())
    }

    pub async fn purchase_domain(&self, mut input: Value) -> Result<Value, PxxlError> {
        if let Some(customer_id) = input.get("customerId").cloned() {
            if input.get("contactId").is_none() {
                input["contactId"] = customer_id;
            }
            if let Some(object) = input.as_object_mut() {
                object.remove("customerId");
            }
        }
        self.request(
            Method::POST,
            "/cli/domainprovider/domain/register",
            Some(input),
        )
        .await
    }

    pub async fn list_domain_invoices(&self, team_id: Option<&str>) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/cli/domainprovider/invoices{}", self.team_query(team_id)),
            None,
        )
        .await
    }

    pub async fn get_domain_invoice(
        &self,
        id: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!(
                "/cli/domainprovider/invoice/{}{}",
                escape(id),
                self.team_query(team_id)
            ),
            None,
        )
        .await
    }

    pub async fn get_payment_url(
        &self,
        id: &str,
        currency: Option<&str>,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        let mut query = Vec::new();
        if let Some(value) = currency {
            query.push(("currency", value));
        }
        if let Some(value) = team_id.or(self.team_id.as_deref()) {
            query.push(("teamId", value));
        }
        self.request(
            Method::GET,
            &format!(
                "/cli/domainprovider/invoice/{}/payment-url{}",
                escape(id),
                query_string(Some(&query))
            ),
            None,
        )
        .await
    }

    pub async fn pay_domain_invoice(
        &self,
        id: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::POST,
            "/cli/domainprovider/invoice/pay",
            Some(json!({ "invoiceId": id, "teamId": team_id.or(self.team_id.as_deref()) })),
        )
        .await
    }

    pub async fn cancel_domain_invoice(
        &self,
        id: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::POST,
            &format!(
                "/cli/domainprovider/invoice/{}/cancel{}",
                escape(id),
                self.team_query(team_id)
            ),
            Some(json!({})),
        )
        .await
    }

    pub async fn list_purchased_domains(&self) -> Result<Value, PxxlError> {
        self.request(Method::GET, "/cli/purchased-domains", None)
            .await
    }

    pub async fn list_projects(&self, query: Option<&[(&str, &str)]>) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/cli/projects{}", query_string(query)),
            None,
        )
        .await
    }

    pub async fn get_project(&self, id: &str) -> Result<Value, PxxlError> {
        self.request(Method::GET, &format!("/cli/projects/{}", escape(id)), None)
            .await
    }

    pub async fn project_deployments(
        &self,
        id: &str,
        query: Option<&[(&str, &str)]>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!(
                "/cli/projects/{}/deployments{}",
                escape(id),
                query_string(query)
            ),
            None,
        )
        .await
    }

    pub async fn project_logs(
        &self,
        id: &str,
        live: bool,
        query: Option<&[(&str, &str)]>,
    ) -> Result<Value, PxxlError> {
        let suffix = if live { "live-logs" } else { "logs" };
        self.request(
            Method::GET,
            &format!(
                "/cli/projects/{}/{suffix}{}",
                escape(id),
                query_string(query)
            ),
            None,
        )
        .await
    }

    pub async fn list_deployments(
        &self,
        query: Option<&[(&str, &str)]>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/cli/deployments{}", query_string(query)),
            None,
        )
        .await
    }

    pub async fn get_deployment(&self, id: &str) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/cli/deployments/{}", escape(id)),
            None,
        )
        .await
    }

    pub async fn deployment_logs(&self, id: &str, build: bool) -> Result<Value, PxxlError> {
        let suffix = if build { "build-logs" } else { "logs" };
        self.request(
            Method::GET,
            &format!("/cli/deployments/{}/{suffix}", escape(id)),
            None,
        )
        .await
    }

    pub async fn list_project_env(&self, id: &str, global: bool) -> Result<Value, PxxlError> {
        self.request(Method::GET, &project_env_path(id, global), None)
            .await
    }

    pub async fn diff_project_env(
        &self,
        id: &str,
        global: bool,
        input: Value,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::POST,
            &format!("{}/diff", project_env_path(id, global)),
            Some(input),
        )
        .await
    }

    pub async fn push_project_env(
        &self,
        id: &str,
        global: bool,
        input: Value,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::POST,
            &format!("{}/bulk", project_env_path(id, global)),
            Some(input),
        )
        .await
    }

    pub async fn list_databases(&self, team_id: Option<&str>) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/databases{}", self.team_query(team_id)),
            None,
        )
        .await
    }

    pub async fn get_database(&self, id: &str, team_id: Option<&str>) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/databases/{}{}", escape(id), self.team_query(team_id)),
            None,
        )
        .await
    }

    pub async fn create_database(&self, input: Value) -> Result<Value, PxxlError> {
        self.request(Method::POST, "/databases", Some(input)).await
    }

    pub async fn update_database(
        &self,
        id: &str,
        input: Value,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::PATCH,
            &format!("/databases/{}{}", escape(id), self.team_query(team_id)),
            Some(input),
        )
        .await
    }

    pub async fn delete_database(&self, id: &str, team_id: Option<&str>) -> Result<(), PxxlError> {
        self.raw(
            Method::DELETE,
            &format!("/databases/{}{}", escape(id), self.team_query(team_id)),
            None,
        )
        .await?;
        Ok(())
    }

    pub async fn database_action(
        &self,
        id: &str,
        action: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        if !matches!(action, "start" | "stop" | "restart") {
            return Err(PxxlError::InvalidInput(
                "database action must be start, stop, or restart".into(),
            ));
        }
        self.request(
            Method::POST,
            &format!(
                "/databases/{}/{action}{}",
                escape(id),
                self.team_query(team_id)
            ),
            Some(json!({})),
        )
        .await
    }

    pub async fn database_metrics(
        &self,
        id: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.database_read(id, "metrics", team_id).await
    }

    pub async fn database_stats(
        &self,
        id: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.database_read(id, "stats", team_id).await
    }

    pub async fn database_tables(
        &self,
        id: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.database_read(id, "tables", team_id).await
    }

    pub async fn database_usage(
        &self,
        id: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.database_read(id, "usage", team_id).await
    }

    pub async fn reveal_database_credential(
        &self,
        id: &str,
        field: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!(
                "/databases/{}/credentials/{}{}",
                escape(id),
                escape(field),
                self.team_query(team_id)
            ),
            None,
        )
        .await
    }

    pub async fn list_teams(&self) -> Result<Value, PxxlError> {
        self.request(Method::GET, "/teams", None).await
    }

    pub async fn get_team(&self, id: &str) -> Result<Value, PxxlError> {
        self.request(Method::GET, &format!("/teams/{}", escape(id)), None)
            .await
    }

    pub async fn list_team_databases(&self, id: &str) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/teams/{}/databases", escape(id)),
            None,
        )
        .await
    }

    pub async fn mcp_rpc(
        &self,
        method: &str,
        params: Value,
        endpoint: Option<&str>,
    ) -> Result<Value, PxxlError> {
        let response = self
            .http
            .post(endpoint.unwrap_or(PXXL_MCP_ENDPOINT))
            .bearer_auth(&self.api_key)
            .header("Content-Type", "application/json")
            .header("MCP-Protocol-Version", PXXL_MCP_PROTOCOL_VERSION)
            .json(
                &json!({ "jsonrpc": "2.0", "id": "pxxl-rust", "method": method, "params": params }),
            )
            .send()
            .await?;
        let status = response.status();
        let payload: Value = response.json().await?;
        if !status.is_success() || payload.get("error").is_some() {
            return Err(PxxlError::Api {
                status: status.as_u16(),
                message: payload
                    .pointer("/error/message")
                    .and_then(Value::as_str)
                    .unwrap_or("MCP request failed")
                    .to_string(),
                body: payload.to_string(),
            });
        }
        Ok(payload.get("result").cloned().unwrap_or_else(|| json!({})))
    }

    async fn database_read(
        &self,
        id: &str,
        suffix: &str,
        team_id: Option<&str>,
    ) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!(
                "/databases/{}/{suffix}{}",
                escape(id),
                self.team_query(team_id)
            ),
            None,
        )
        .await
    }
}

fn project_env_path(id: &str, global: bool) -> String {
    let suffix = if global { "global-envs" } else { "envs" };
    format!("/cli/projects/{}/{suffix}", escape(id))
}

fn domain_name_from_value(value: &Value) -> String {
    let paths: &[&[&str]] = &[
        &["name"],
        &["domainName"],
        &["domain"],
        &["domain", "name"],
        &["domain", "domain"],
        &["data", "name"],
        &["data", "domainName"],
        &["data", "domain"],
        &["data", "domain", "name"],
        &["data", "domain", "domain"],
    ];
    for path in paths {
        let mut current = value;
        let mut matched = true;
        for key in *path {
            match current.get(*key) {
                Some(next) => current = next,
                None => {
                    matched = false;
                    break;
                }
            }
        }
        if matched {
            if let Some(domain) = current.as_str() {
                let domain = domain.trim().trim_end_matches('.').to_lowercase();
                if !domain.is_empty() {
                    return domain;
                }
            }
        }
    }
    String::new()
}

fn is_cv_domain_name(domain: &str) -> bool {
    domain
        .trim()
        .trim_end_matches('.')
        .to_lowercase()
        .ends_with(".cv")
}

fn is_cv_zone_only_error(error: &PxxlError) -> bool {
    matches!(
        error,
        PxxlError::Api { message, .. }
            if message
                .to_lowercase()
                .contains("zone status is only available for .cv domains")
    )
}

#[derive(Debug, Default)]
pub struct UploadAsset {
    pub file_name: String,
    pub bytes: Vec<u8>,
    pub visibility: Option<String>,
    pub kind: Option<String>,
    pub project_id: Option<String>,
    pub deployment_id: Option<String>,
    pub bucket_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CdnSummary {
    #[serde(rename = "totalFiles")]
    pub total_files: i64,
    #[serde(rename = "storageBytes")]
    pub storage_bytes: i64,
    #[serde(rename = "recentAssets", default)]
    pub recent_assets: Vec<CdnAsset>,
}

#[derive(Debug, Deserialize)]
pub struct CdnAsset {
    pub id: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    pub size: i64,
    #[serde(rename = "publicUrl")]
    pub public_url: Option<String>,
    pub visibility: String,
}

#[derive(Debug, Deserialize)]
pub struct DomainSearchResponse {
    pub query: String,
    pub count: i64,
    pub results: Vec<Value>,
}

#[derive(Debug, Serialize)]
pub struct VerifyDomainRecord {
    pub domain: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "teamId", skip_serializing_if = "Option::is_none")]
    pub team_id: Option<String>,
}

#[derive(Debug, Default, Serialize)]
pub struct DomainDnsRecord {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ttl: Option<i64>,
    #[serde(rename = "recordId", skip_serializing_if = "Option::is_none")]
    pub record_id: Option<String>,
}

#[derive(Debug, Default, Serialize)]
pub struct CreateCronJob {
    pub name: String,
    pub schedule: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
    #[serde(rename = "timeoutSeconds", skip_serializing_if = "Option::is_none")]
    pub timeout_seconds: Option<i64>,
    #[serde(rename = "projectId", skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(rename = "teamId", skip_serializing_if = "Option::is_none")]
    pub team_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CronJob {
    pub id: String,
    pub name: String,
    pub schedule: String,
    pub url: String,
    pub method: String,
    pub status: String,
}

#[derive(Debug, Default)]
pub struct DeployInput {
    pub directory: Option<PathBuf>,
    pub archive_path: Option<PathBuf>,
    pub name: Option<String>,
    pub project_id: Option<String>,
    pub domain_choice: Option<String>,
    pub environment: Option<String>,
    pub language: Option<String>,
    pub framework: Option<String>,
    pub package_manager: Option<String>,
    pub install_command: Option<String>,
    pub build_command: Option<String>,
    pub start_command: Option<String>,
    pub commit_message: Option<String>,
}

pub fn create_project_zip(root: impl AsRef<Path>) -> Result<Vec<u8>, PxxlError> {
    let root = root.as_ref();
    let mut files = Vec::new();
    let mut total = 0_u64;
    for entry in WalkDir::new(root).into_iter().filter_map(Result::ok) {
        if !entry.file_type().is_file() {
            continue;
        }
        let rel = entry.path().strip_prefix(root).unwrap_or(entry.path());
        let rel_str = rel.to_string_lossy().replace('\\', "/");
        if should_skip_deploy_path(&rel_str) || looks_sensitive(&rel_str) {
            continue;
        }
        total += std::fs::metadata(entry.path())?.len();
        if total > MAX_DEPLOY_SOURCE_BYTES {
            return Err(PxxlError::InvalidInput(
                "deploy archive exceeds 220MB source limit".into(),
            ));
        }
        files.push((entry.path().to_path_buf(), rel_str));
        if files.len() > MAX_DEPLOY_FILES {
            return Err(PxxlError::InvalidInput(
                "deploy archive exceeds file count limit".into(),
            ));
        }
    }
    if files.is_empty() {
        return Err(PxxlError::InvalidInput("no deployable files found".into()));
    }
    files.sort_by(|a, b| a.1.cmp(&b.1));

    let mut cursor = Cursor::new(Vec::new());
    let mut zip = zip::ZipWriter::new(&mut cursor);
    let options: FileOptions<'_, ()> =
        FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    for (file_path, rel) in files {
        zip.start_file(rel, options)?;
        let bytes = std::fs::read(file_path)?;
        zip.write_all(&bytes)?;
    }
    zip.finish()?;
    Ok(cursor.into_inner())
}

fn add_text(form: multipart::Form, key: &'static str, value: Option<String>) -> multipart::Form {
    if let Some(value) = value {
        if !value.trim().is_empty() {
            return form.text(key, value);
        }
    }
    form
}

fn query_string(values: Option<&[(&str, &str)]>) -> String {
    let Some(values) = values else {
        return String::new();
    };
    let encoded = values
        .iter()
        .filter(|(_, value)| !value.is_empty())
        .map(|(key, value)| format!("{}={}", escape(key), escape(value)))
        .collect::<Vec<_>>()
        .join("&");
    if encoded.is_empty() {
        String::new()
    } else {
        format!("?{}", encoded)
    }
}

fn escape(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                vec![byte as char]
            }
            _ => format!("%{:02X}", byte).chars().collect(),
        })
        .collect()
}

fn should_skip_deploy_path(rel: &str) -> bool {
    let first = rel.split('/').next().unwrap_or("");
    matches!(
        first,
        ".git" | "node_modules" | ".next" | ".turbo" | ".cache" | "dist" | "build" | ".output"
    ) || rel.ends_with(".log")
        || rel.split('/').last().is_some_and(|base| {
            base == ".pxxlignore" || base.starts_with(".env") || base == "pxxl-source.zip"
        })
}

fn looks_sensitive(rel: &str) -> bool {
    let lower = rel.to_ascii_lowercase();
    lower.ends_with(".pem")
        || lower.ends_with(".key")
        || lower.contains("id_rsa")
        || lower.contains("service-account")
        || lower.contains("credentials.json")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requires_api_key() {
        assert!(matches!(PxxlClient::new(""), Err(PxxlError::MissingApiKey)));
    }

    #[test]
    fn query_encoding_works() {
        assert_eq!(
            query_string(Some(&[("teamId", "team one")])),
            "?teamId=team%20one"
        );
    }

    #[tokio::test]
    async fn raw_request_rejects_absolute_urls() {
        let client = PxxlClient::new("pxxl_test").unwrap();
        let error = client
            .request_json("GET", "https://example.com", None)
            .await
            .unwrap_err();
        assert!(error.to_string().contains("must start with /"));
    }

    #[test]
    fn project_environment_paths_are_stable() {
        assert_eq!(
            project_env_path("proj_1", false),
            "/cli/projects/proj_1/envs"
        );
        assert_eq!(
            project_env_path("proj_1", true),
            "/cli/projects/proj_1/global-envs"
        );
    }
}
