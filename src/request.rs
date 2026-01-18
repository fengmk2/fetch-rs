use crate::response::JsResponse;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use parking_lot::Mutex;
use std::sync::Arc;
use tokio::sync::oneshot;

/// Header as a two-element array [name, value] for JavaScript
#[napi(object)]
#[derive(Debug, Clone)]
pub struct HeaderPair {
    pub name: String,
    pub value: String,
}

/// Request context passed from Rust to JavaScript handler
/// Contains all request information and a callback to send the response
#[napi]
pub struct RequestContext {
    /// HTTP method (GET, POST, PUT, DELETE, etc.)
    pub(crate) method: String,
    /// Full URL including scheme, host, path, and query string
    pub(crate) url: String,
    /// Request headers as key-value pairs
    pub(crate) headers: Vec<HeaderPair>,
    /// Request body (None if no body or empty body)
    pub(crate) body: Option<Buffer>,
    /// Client IP address
    pub(crate) client_address: String,
    /// Internal: Channel to send response back to Rust (skipped from napi)
    #[napi(skip)]
    pub response_sender: Option<Arc<Mutex<Option<oneshot::Sender<JsResponse>>>>>,
}

#[napi]
impl RequestContext {
    /// Get the HTTP method
    #[napi(getter)]
    pub fn get_method(&self) -> String {
        self.method.clone()
    }

    /// Get the full URL
    #[napi(getter)]
    pub fn get_url(&self) -> String {
        self.url.clone()
    }

    /// Get headers as an array of {name, value} objects
    #[napi(getter)]
    pub fn get_headers(&self) -> Vec<HeaderPair> {
        self.headers.clone()
    }

    /// Get the request body as a Buffer (or null if no body)
    #[napi(getter)]
    pub fn get_body(&self) -> Option<Buffer> {
        self.body
            .as_ref()
            .map(|b| Buffer::from(b.as_ref().to_vec()))
    }

    /// Get the client IP address
    #[napi(getter, js_name = "clientAddress")]
    pub fn get_client_address(&self) -> String {
        self.client_address.clone()
    }

    /// Send a response back to the client
    /// This must be called exactly once per request
    #[napi]
    pub fn respond(&self, response: JsResponse) -> Result<()> {
        if let Some(sender_arc) = &self.response_sender {
            let mut sender_guard = sender_arc.lock();
            if let Some(sender) = sender_guard.take() {
                sender
                    .send(response)
                    .map_err(|_| Error::new(Status::GenericFailure, "Failed to send response"))?;
                Ok(())
            } else {
                Err(Error::new(Status::GenericFailure, "Response already sent"))
            }
        } else {
            Err(Error::new(
                Status::GenericFailure,
                "No response channel available",
            ))
        }
    }
}

/// Body handle for streaming large request bodies
/// Used when the body is too large to buffer in memory
#[napi]
pub struct BodyHandle {
    receiver: Option<tokio::sync::mpsc::Receiver<bytes::Bytes>>,
}

#[napi]
impl BodyHandle {
    /// Read the next chunk of the body
    /// Returns null when the body is fully consumed
    /// Note: This is marked unsafe because it takes &mut self in async context
    #[napi]
    pub async unsafe fn read(&mut self) -> Result<Option<Buffer>> {
        if let Some(ref mut rx) = self.receiver {
            match rx.recv().await {
                Some(chunk) => Ok(Some(Buffer::from(chunk.to_vec()))),
                None => Ok(None), // Stream ended
            }
        } else {
            Ok(None)
        }
    }

    /// Check if there's more data to read
    #[napi]
    pub fn is_closed(&self) -> bool {
        self.receiver.is_none()
    }
}

impl BodyHandle {
    /// Create a new BodyHandle from a channel receiver
    pub fn new(receiver: tokio::sync::mpsc::Receiver<bytes::Bytes>) -> Self {
        Self {
            receiver: Some(receiver),
        }
    }
}
