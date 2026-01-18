use crate::request::{HeaderPair, RequestContext};
use crate::response::JsResponse;
use crate::ServerOptions;
use crate::ServerStats;

use axum::{
    body::Body,
    extract::{ConnectInfo, Request},
    http::StatusCode,
    response::Response,
    routing::any,
    Router,
};
use bytes::Bytes;
use http_body_util::BodyExt;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use parking_lot::{Mutex, RwLock};
use socket2::{Domain, Protocol, Socket, Type};
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::net::TcpListener;
use tokio::sync::{oneshot, Notify};

/// Server configuration derived from ServerOptions
#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u32,
    pub reuse_port: bool,
    pub max_connections: u32,
    pub max_body_size: u32,
    pub timeout_ms: u32,
}

impl From<&ServerOptions> for ServerConfig {
    fn from(opts: &ServerOptions) -> Self {
        Self {
            host: opts.host.clone().unwrap_or_else(|| "0.0.0.0".to_string()),
            port: opts.port,
            reuse_port: opts.reuse_port.unwrap_or(false),
            max_connections: opts.max_connections.unwrap_or(65536),
            max_body_size: opts.max_body_size.unwrap_or(10 * 1024 * 1024),
            timeout_ms: opts.timeout.unwrap_or(30000),
        }
    }
}

/// Internal server state
pub struct ServerInner {
    config: ServerConfig,
    handler: RwLock<Option<ThreadsafeFunction<RequestContext, ErrorStrategy::Fatal>>>,
    shutdown_notify: Arc<Notify>,
    stats: ServerStatsInner,
}

/// Internal statistics tracking
struct ServerStatsInner {
    active_connections: AtomicU32,
    total_requests: AtomicU64,
    total_latency_us: AtomicU64,
}

impl ServerStatsInner {
    fn new() -> Self {
        Self {
            active_connections: AtomicU32::new(0),
            total_requests: AtomicU64::new(0),
            total_latency_us: AtomicU64::new(0),
        }
    }
}

impl ServerInner {
    pub fn new(config: ServerConfig) -> Self {
        Self {
            config,
            handler: RwLock::new(None),
            shutdown_notify: Arc::new(Notify::new()),
            stats: ServerStatsInner::new(),
        }
    }

    pub fn set_handler(&self, handler: ThreadsafeFunction<RequestContext, ErrorStrategy::Fatal>) {
        *self.handler.write() = Some(handler);
    }

    pub async fn listen(
        self: &Arc<Self>,
        addr: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let addr: SocketAddr = addr.parse()?;
        let listener = self.create_listener(addr)?;

        let server_inner = Arc::clone(self);
        let server_inner2 = Arc::clone(self);

        let app = Router::new()
            .route(
                "/*path",
                any(move |connect_info: ConnectInfo<SocketAddr>, req: Request| {
                    let inner = Arc::clone(&server_inner);
                    async move { inner.handle_request(connect_info.0, req).await }
                }),
            )
            .route(
                "/",
                any(move |connect_info: ConnectInfo<SocketAddr>, req: Request| {
                    let inner = Arc::clone(&server_inner2);
                    async move { inner.handle_request(connect_info.0, req).await }
                }),
            );

        let listener = TcpListener::from_std(listener.into())?;

        tracing::info!("Server listening on {}", addr);

        let shutdown_notify = Arc::clone(&self.shutdown_notify);

        // Use axum's serve with graceful shutdown
        axum::serve(
            listener,
            app.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .with_graceful_shutdown(async move {
            shutdown_notify.notified().await;
        })
        .await?;

        Ok(())
    }

    fn create_listener(&self, addr: SocketAddr) -> std::io::Result<std::net::TcpListener> {
        let domain = if addr.is_ipv4() {
            Domain::IPV4
        } else {
            Domain::IPV6
        };

        let socket = Socket::new(domain, Type::STREAM, Some(Protocol::TCP))?;

        // Allow address reuse
        socket.set_reuse_address(true)?;

        // Enable SO_REUSEPORT on Unix for multi-core scaling
        #[cfg(unix)]
        if self.config.reuse_port {
            socket.set_reuse_port(true)?;
        }

        socket.set_nonblocking(true)?;
        socket.bind(&addr.into())?;
        socket.listen(8192)?; // Large backlog for high concurrency

        Ok(socket.into())
    }

    async fn handle_request(
        self: &Arc<Self>,
        client_addr: SocketAddr,
        req: Request,
    ) -> Response<Body> {
        let start = Instant::now();
        self.stats
            .active_connections
            .fetch_add(1, Ordering::Relaxed);

        let response = self.process_request(client_addr, req).await;

        self.stats
            .active_connections
            .fetch_sub(1, Ordering::Relaxed);
        self.stats.total_requests.fetch_add(1, Ordering::Relaxed);
        self.stats.total_latency_us.fetch_add(
            start.elapsed().as_micros() as u64,
            Ordering::Relaxed,
        );

        response
    }

    async fn process_request(
        self: &Arc<Self>,
        client_addr: SocketAddr,
        req: Request,
    ) -> Response<Body> {
        let handler = {
            let guard = self.handler.read();
            guard.clone()
        };

        let handler = match handler {
            Some(h) => h,
            None => {
                return Response::builder()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .body(Body::from("No handler registered"))
                    .unwrap();
            }
        };

        // Extract request parts
        let (parts, body) = req.into_parts();

        // Collect body bytes (for bodies within size limit)
        let body_bytes = match body.collect().await {
            Ok(collected) => collected.to_bytes(),
            Err(e) => {
                return Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .body(Body::from(format!("Failed to read body: {}", e)))
                    .unwrap();
            }
        };

        // Check body size limit
        if body_bytes.len() > self.config.max_body_size as usize {
            return Response::builder()
                .status(StatusCode::PAYLOAD_TOO_LARGE)
                .body(Body::from("Request body too large"))
                .unwrap();
        }

        // Build full URL
        let url = build_url(&parts);

        // Extract headers as vec of HeaderPair
        let headers: Vec<HeaderPair> = parts
            .headers
            .iter()
            .map(|(name, value)| HeaderPair {
                name: name.to_string(),
                value: value.to_str().unwrap_or("").to_string(),
            })
            .collect();

        // Create oneshot channel for response
        let (tx, rx) = oneshot::channel::<JsResponse>();

        // Create request context
        let request_context = RequestContext {
            method: parts.method.to_string(),
            url,
            headers,
            body: if body_bytes.is_empty() {
                None
            } else {
                Some(napi::bindgen_prelude::Buffer::from(body_bytes.to_vec()))
            },
            client_address: client_addr.to_string(),
            response_sender: Some(Arc::new(Mutex::new(Some(tx)))),
        };

        // Call JavaScript handler
        handler.call(request_context, ThreadsafeFunctionCallMode::NonBlocking);

        // Wait for response from JavaScript
        match tokio::time::timeout(
            std::time::Duration::from_millis(self.config.timeout_ms as u64),
            rx,
        )
        .await
        {
            Ok(Ok(js_response)) => build_response(js_response),
            Ok(Err(_)) => {
                // Channel closed without response
                Response::builder()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .body(Body::from("Handler did not respond"))
                    .unwrap()
            }
            Err(_) => {
                // Timeout
                Response::builder()
                    .status(StatusCode::GATEWAY_TIMEOUT)
                    .body(Body::from("Request timeout"))
                    .unwrap()
            }
        }
    }

    pub async fn close(&self) {
        self.shutdown_notify.notify_one();
    }

    pub fn stats(&self) -> ServerStats {
        let total_requests = self.stats.total_requests.load(Ordering::Relaxed);
        let total_latency_us = self.stats.total_latency_us.load(Ordering::Relaxed);

        ServerStats {
            active_connections: self.stats.active_connections.load(Ordering::Relaxed),
            total_requests: total_requests as f64,
            requests_per_second: 0.0, // Would need time tracking for rolling average
            avg_latency_ms: if total_requests > 0 {
                (total_latency_us as f64 / total_requests as f64) / 1000.0
            } else {
                0.0
            },
        }
    }
}

fn build_url(parts: &http::request::Parts) -> String {
    let scheme = "http"; // TODO: Support HTTPS
    let host = parts
        .headers
        .get("host")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("localhost");
    let path_and_query = parts
        .uri
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");

    format!("{}://{}{}", scheme, host, path_and_query)
}

fn build_response(js_response: JsResponse) -> Response<Body> {
    let mut builder = Response::builder().status(js_response.status);

    for header in js_response.headers {
        builder = builder.header(header.name, header.value);
    }

    let body = match js_response.body {
        Some(buffer) => Body::from(Bytes::from(buffer.to_vec())),
        None => Body::empty(),
    };

    builder.body(body).unwrap()
}
