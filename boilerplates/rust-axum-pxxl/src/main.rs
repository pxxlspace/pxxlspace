use axum::{Json, Router, routing::get};
use serde_json::{Value, json};
use std::{env, net::SocketAddr};

async fn index() -> Json<Value> {
    Json(json!({ "ok": true, "service": "Rust Axum on Pxxl" }))
}

#[tokio::main]
async fn main() {
    let port = env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr: SocketAddr = format!("0.0.0.0:{port}").parse().expect("valid listen address");
    let app = Router::new().route("/", get(index));
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind");
    axum::serve(listener, app).await.expect("server");
}
