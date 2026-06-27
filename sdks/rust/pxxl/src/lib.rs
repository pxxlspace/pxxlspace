use reqwest::{multipart, Client, Method};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::{Cursor, Write};
use std::path::{Path, PathBuf};
use thiserror::Error;
use walkdir::WalkDir;
use zip::write::FileOptions;

pub const PXXL_API_BASE_URL: &str = "https://gateway.pxxl.app/api/v3";
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

    pub async fn get_domain(&self, id: &str, team_id: Option<&str>) -> Result<Value, PxxlError> {
        self.request(
            Method::GET,
            &format!("/cli/domains/{}{}", escape(id), self.team_query(team_id)),
            None,
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

#[derive(Debug, Default)]
pub struct UploadAsset {
    pub file_name: String,
    pub bytes: Vec<u8>,
    pub visibility: Option<String>,
    pub kind: Option<String>,
    pub project_id: Option<String>,
    pub deployment_id: Option<String>,
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
}
