use napi::bindgen_prelude::*;
use napi_derive::napi;

/// Header key-value pair for use in JsResponse
#[napi(object)]
#[derive(Debug, Clone)]
pub struct JsHeader {
    pub name: String,
    pub value: String,
}

/// Response object passed from JavaScript to Rust
/// Contains the HTTP response data to send back to the client
#[napi(object)]
#[derive(Clone)]
pub struct JsResponse {
    /// HTTP status code (200, 404, 500, etc.)
    pub status: u16,
    /// Response headers as key-value pairs
    pub headers: Vec<JsHeader>,
    /// Response body (None for empty body)
    pub body: Option<Buffer>,
}

impl std::fmt::Debug for JsResponse {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("JsResponse")
            .field("status", &self.status)
            .field("headers", &self.headers)
            .field("body", &self.body.as_ref().map(|b| format!("<Buffer {} bytes>", b.len())))
            .finish()
    }
}

impl JsResponse {
    /// Create a new response with the given status, headers, and body
    pub fn new(status: u16, headers: Vec<(String, String)>, body: Option<Vec<u8>>) -> Self {
        Self {
            status,
            headers: headers
                .into_iter()
                .map(|(name, value)| JsHeader { name, value })
                .collect(),
            body: body.map(Buffer::from),
        }
    }

    /// Create a simple text response
    pub fn text(body: &str, status: u16) -> Self {
        Self::new(
            status,
            vec![("content-type".to_string(), "text/plain".to_string())],
            Some(body.as_bytes().to_vec()),
        )
    }

    /// Create a JSON response
    pub fn json(body: &str, status: u16) -> Self {
        Self::new(
            status,
            vec![("content-type".to_string(), "application/json".to_string())],
            Some(body.as_bytes().to_vec()),
        )
    }

    /// Create an empty response with the given status
    pub fn empty(status: u16) -> Self {
        Self::new(status, vec![], None)
    }
}

impl Default for JsResponse {
    fn default() -> Self {
        Self::empty(200)
    }
}
