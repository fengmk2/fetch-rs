#![deny(clippy::all)]

mod request;
mod response;
mod server;

use napi::bindgen_prelude::*;
use napi::threadsafe_function::ThreadsafeFunction;
use napi_derive::napi;
use std::sync::Arc;

pub use request::RequestContext;
pub use response::{JsHeader, JsResponse};
pub use server::{ServerConfig, ServerInner};

/// Server options passed from JavaScript
#[napi(object)]
#[derive(Debug, Clone)]
pub struct ServerOptions {
    /// Port to listen on
    pub port: u32,
    /// Host to bind to (default: "0.0.0.0")
    pub host: Option<String>,
    /// Enable SO_REUSEPORT for multi-core scaling
    pub reuse_port: Option<bool>,
    /// Maximum concurrent connections (default: 65536)
    pub max_connections: Option<u32>,
    /// Request body size limit in bytes (default: 10MB)
    pub max_body_size: Option<u32>,
    /// Request timeout in milliseconds (default: 30000)
    pub timeout: Option<u32>,
}

impl Default for ServerOptions {
    fn default() -> Self {
        Self {
            port: 3000,
            host: Some("0.0.0.0".to_string()),
            max_connections: Some(65536),
            max_body_size: Some(10 * 1024 * 1024), // 10MB
            timeout: Some(30000),
            reuse_port: Some(false),
        }
    }
}

/// Server statistics
#[napi(object)]
#[derive(Debug, Clone, Default)]
pub struct ServerStats {
    /// Number of active connections
    pub active_connections: u32,
    /// Total requests handled (as f64 to avoid napi u64 issues)
    pub total_requests: f64,
    /// Requests per second (rolling average)
    pub requests_per_second: f64,
    /// Average latency in milliseconds
    pub avg_latency_ms: f64,
}

/// High-performance HTTP server with Fetch Event API
#[napi]
pub struct Server {
    inner: Arc<ServerInner>,
    options: ServerOptions,
}

#[napi]
impl Server {
    /// Create a new server with the given options
    #[napi(constructor)]
    pub fn new(options: ServerOptions) -> Result<Self> {
        let inner = Arc::new(ServerInner::new(ServerConfig::from(&options)));
        Ok(Self { inner, options })
    }

    /// Set the fetch event handler
    /// This should be called before listen()
    #[napi]
    pub fn set_handler(&self, handler: ThreadsafeFunction<RequestContext, ()>) -> Result<()> {
        self.inner.set_handler(handler);
        Ok(())
    }

    /// Start the server and begin accepting connections
    #[napi]
    pub async fn listen(&self) -> Result<()> {
        let addr = format!(
            "{}:{}",
            self.options.host.as_deref().unwrap_or("0.0.0.0"),
            self.options.port
        );

        let inner = Arc::clone(&self.inner);
        inner.listen(&addr).await.map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to start server: {}", e),
            )
        })
    }

    /// Gracefully shutdown the server
    #[napi]
    pub async fn close(&self) -> Result<()> {
        self.inner.close().await;
        Ok(())
    }

    /// Get current server statistics
    #[napi]
    pub fn stats(&self) -> ServerStats {
        self.inner.stats()
    }
}
