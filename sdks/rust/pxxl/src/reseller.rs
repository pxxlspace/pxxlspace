//! Domain reselling (Pro plan and up).
//!
//! Make the client with a reseller key (`pxxl_rsl_...`, from Tools > Domain
//! reseller) and call `client.reseller()`. Every purchase is charged to your
//! Pxxl wallet at the wholesale price.
//!
//! ```no_run
//! # async fn run() -> Result<(), pxxl::PxxlError> {
//! let client = pxxl::PxxlClient::new(std::env::var("PXXL_RESELLER_KEY").unwrap())?;
//! let quote = client.reseller().quote("example.cv", 1).await?;
//! println!("costs {} cents", quote["chargeMinor"]);
//! # Ok(()) }
//! ```

use crate::{escape, PxxlClient, PxxlError};
use reqwest::Method;
use serde::Serialize;
use serde_json::{json, Value};

/// The domain reseller API.
pub struct Reseller<'a> {
    client: &'a PxxlClient,
}

/// A registration. `contact`/`address` (or `contact_id`) name the registrant.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResellerRegisterInput {
    pub domain: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub years: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nameservers: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<Value>,
    /// `{"reference": "...", "email": "...", "name": "..."}`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub customer: Option<Value>,
    /// Refuse (nothing charged) if the wallet charge is above this, in US cents.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_charge_minor: Option<i64>,
    /// Retries with the same key never buy twice.
    #[serde(skip)]
    pub idempotency_key: Option<String>,
}

impl PxxlClient {
    /// Domain reselling with a reseller key, charged to your wallet.
    pub fn reseller(&self) -> Reseller<'_> {
        Reseller { client: self }
    }
}

impl<'a> Reseller<'a> {
    async fn call(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
        idempotency_key: Option<&str>,
    ) -> Result<Value, PxxlError> {
        let full = format!("/domain-reseller{}", path);
        let headers: Vec<(&str, &str)> = idempotency_key
            .filter(|k| !k.is_empty())
            .map(|k| vec![("Idempotency-Key", k)])
            .unwrap_or_default();
        let bytes = self
            .client
            .raw_with_headers(method, &full, body, &headers)
            .await?;
        if bytes.is_empty() {
            return Ok(Value::Null);
        }
        serde_json::from_slice(&bytes).map_err(|error| PxxlError::InvalidInput(error.to_string()))
    }

    fn domain_path(domain: &str, rest: &str) -> String {
        format!("/domains/{}{}", escape(domain.trim()), rest)
    }

    /// Plan access, wallet balance, markup settings and wholesale terms.
    pub async fn account(&self) -> Result<Value, PxxlError> {
        self.call(Method::GET, "/account", None, None).await
    }

    /// Save markup and flow settings (camelCase keys, e.g. `{"markupPercent": 20}`).
    pub async fn update_settings(&self, settings: Value) -> Result<Value, PxxlError> {
        self.call(Method::PATCH, "/account", Some(settings), None).await
    }

    /// Wholesale and customer prices, optionally for some TLDs.
    pub async fn prices(&self, tlds: &[&str]) -> Result<Value, PxxlError> {
        let path = if tlds.is_empty() {
            "/prices".to_string()
        } else {
            format!("/prices?tld={}", escape(&tlds.join(",")))
        };
        self.call(Method::GET, &path, None, None).await
    }

    /// Availability and price of a registration: `chargeMinor` is what your
    /// wallet is charged (US cents); `customerPrice*` adds your markup.
    pub async fn quote(&self, domain: &str, years: u32) -> Result<Value, PxxlError> {
        let mut path = format!("/availability?domain={}", escape(domain.trim()));
        if years > 0 {
            path.push_str(&format!("&years={}", years));
        }
        let body = self.call(Method::GET, &path, None, None).await?;
        Ok(body.get("quote").cloned().unwrap_or(body))
    }

    /// Buy a domain and charge your wallet.
    pub async fn register(&self, input: ResellerRegisterInput) -> Result<Value, PxxlError> {
        let key = input.idempotency_key.clone();
        let body = serde_json::to_value(&input).map_err(|e| PxxlError::InvalidInput(e.to_string()))?;
        self.call(Method::POST, "/domains", Some(body), key.as_deref()).await
    }

    /// Renew for `years` more and charge your wallet.
    pub async fn renew(&self, domain: &str, years: u32, idempotency_key: Option<&str>) -> Result<Value, PxxlError> {
        self.call(Method::POST, &Self::domain_path(domain, "/renew"), Some(json!({ "years": years })), idempotency_key).await
    }

    /// Transfer a domain in from another registrar (not .cv) and charge your wallet.
    pub async fn transfer_in(&self, domain: &str, auth_code: &str, years: u32, customer: Option<Value>) -> Result<Value, PxxlError> {
        let mut body = json!({ "domain": domain, "authCode": auth_code, "years": years });
        if let Some(customer) = customer {
            body["customer"] = customer;
        }
        self.call(Method::POST, "/transfers", Some(body), None).await
    }

    /// Domains you resold. `query` pairs: customerRef, status, search, limit, offset.
    pub async fn list(&self, query: &[(&str, &str)]) -> Result<Value, PxxlError> {
        let encoded: Vec<String> = query
            .iter()
            .filter(|(_, v)| !v.is_empty())
            .map(|(k, v)| format!("{}={}", escape(k), escape(v)))
            .collect();
        let path = if encoded.is_empty() { "/domains".to_string() } else { format!("/domains?{}", encoded.join("&")) };
        self.call(Method::GET, &path, None, None).await
    }

    /// One domain with its registrar status.
    pub async fn get(&self, domain: &str) -> Result<Value, PxxlError> {
        let body = self.call(Method::GET, &Self::domain_path(domain, ""), None, None).await?;
        Ok(body.get("domain").cloned().unwrap_or(body))
    }

    /// Change who a domain was sold to.
    pub async fn update_customer(&self, domain: &str, customer: Value) -> Result<Value, PxxlError> {
        self.call(Method::PATCH, &Self::domain_path(domain, ""), Some(json!({ "customer": customer })), None).await
    }

    pub async fn dns_records(&self, domain: &str) -> Result<Value, PxxlError> {
        self.call(Method::GET, &Self::domain_path(domain, "/dns-records"), None, None).await
    }

    /// Add or update one record, e.g. `json!({"type": "A", "name": "@", "value": "1.2.3.4"})`.
    pub async fn set_dns_record(&self, domain: &str, record: Value) -> Result<Value, PxxlError> {
        self.call(Method::POST, &Self::domain_path(domain, "/dns-records"), Some(record), None).await
    }

    pub async fn replace_dns_records(&self, domain: &str, record: Value) -> Result<Value, PxxlError> {
        self.call(Method::PUT, &Self::domain_path(domain, "/dns-records"), Some(record), None).await
    }

    /// Delete a record by `{"id": ...}` (with `"zoneId"` for .cv) or by type, name and value.
    pub async fn delete_dns_record(&self, domain: &str, record: Value) -> Result<Value, PxxlError> {
        self.call(Method::DELETE, &Self::domain_path(domain, "/dns-records"), Some(record), None).await
    }

    pub async fn set_nameservers(&self, domain: &str, nameservers: &[&str]) -> Result<Value, PxxlError> {
        self.call(Method::POST, &Self::domain_path(domain, "/nameservers"), Some(json!({ "nameservers": nameservers })), None).await
    }

    pub async fn reset_nameservers(&self, domain: &str) -> Result<Value, PxxlError> {
        self.call(Method::POST, &Self::domain_path(domain, "/nameservers/reset"), None, None).await
    }

    pub async fn verify_nameservers(&self, domain: &str) -> Result<Value, PxxlError> {
        self.call(Method::POST, &Self::domain_path(domain, "/nameservers/verify"), None, None).await
    }

    pub async fn zone_status(&self, domain: &str) -> Result<Value, PxxlError> {
        self.call(Method::GET, &Self::domain_path(domain, "/zone-status"), None, None).await
    }

    pub async fn set_registrar_lock(&self, domain: &str, locked: bool) -> Result<Value, PxxlError> {
        self.call(Method::POST, &Self::domain_path(domain, "/registrar-lock"), Some(json!({ "locked": locked })), None).await
    }

    /// The EPP code to move the domain to another registrar (unlocks it).
    pub async fn transfer_code(&self, domain: &str) -> Result<Value, PxxlError> {
        self.call(Method::POST, &Self::domain_path(domain, "/transfer-code"), None, None).await
    }

    /// Wallet charges for reseller purchases.
    pub async fn charges(&self, limit: u32) -> Result<Value, PxxlError> {
        let path = if limit > 0 { format!("/charges?limit={}", limit) } else { "/charges".to_string() };
        self.call(Method::GET, &path, None, None).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn register_input_serializes_camel_case_without_key() {
        let input = ResellerRegisterInput {
            domain: "a.cv".into(),
            years: Some(1),
            max_charge_minor: Some(412),
            idempotency_key: Some("k1".into()),
            ..Default::default()
        };
        let value = serde_json::to_value(&input).unwrap();
        assert_eq!(value, json!({ "domain": "a.cv", "years": 1, "maxChargeMinor": 412 }));
    }

    #[test]
    fn domain_path_escapes() {
        assert_eq!(Reseller::domain_path("a.cv", "/renew"), "/domains/a.cv/renew");
        assert_eq!(Reseller::domain_path("a b", ""), "/domains/a%20b");
    }
}
