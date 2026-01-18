/**
 * fetch-rs: High-performance web server with Fetch Event API
 *
 * This module provides a WinterCG-compatible web server powered by Rust
 * (Axum/hyper/tokio) with zero-copy data transfer via napi-rs.
 */

export { FetchEvent, Request, Response, Headers, type FetchEventHandler } from "./fetch-event.js";

export { Server } from "./server.js";

export type { ServerOptions, ServerStats } from "./server.js";
