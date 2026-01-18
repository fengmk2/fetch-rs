# Benchmarks

Performance benchmarks comparing fetch-rs with native Node.js HTTP server.

## Environment

- **Machine**: Apple Silicon Mac
- **Node.js**: v22.x
- **Rust**: stable
- **Date**: 2026-01-18

## Results

### JSON Response Benchmark

Test endpoint returning `{"message": "Hello, World!"}`.

| Server | Requests | RPS | Latency Avg | Latency P50 | Latency P99 | Throughput |
|--------|----------|-----|-------------|-------------|-------------|------------|
| **fetch-rs** | 1,045,855 | **209,165** | **1.91ms** | 2.00ms | **3ms** | 26.93 MB/s |
| node-http | 743,158 | 148,646 | 2.91ms | 2.00ms | 5ms | 28.49 MB/s |

**fetch-rs is 1.41x faster in RPS and has 1.52x lower average latency**

### Text Response Benchmark

Test endpoint returning plain text `Hello, World!`.

| Server | Requests | RPS | Latency Avg | Latency P50 | Latency P99 | Throughput |
|--------|----------|-----|-------------|-------------|-------------|------------|
| node-http | 754,878 | 150,976 | 2.88ms | 2.00ms | 5ms | 25.92 MB/s |

### Echo Body Benchmark

Test endpoint that echoes back the request body.

| Server | Requests | RPS | Latency Avg | Latency P50 | Latency P99 | Throughput |
|--------|----------|-----|-------------|-------------|-------------|------------|
| node-http | 618,521 | 123,693 | 3.64ms | 3.00ms | 7ms | 21.23 MB/s |

## Configuration

- **Duration**: 5 seconds
- **Connections**: 50 concurrent
- **Pipelining**: 10 requests

## Running Benchmarks

```bash
# Full benchmark (10s, 100 connections)
pnpm bench

# Quick benchmark (5s, 50 connections)
pnpm bench:quick

# Using oha (Rust HTTP load generator)
pnpm bench:oha
# Requires: cargo install oha
```

## Benchmark Scripts

- `server-fetch-rs.ts` - fetch-rs server with /json, /text, /echo endpoints
- `server-node-http.ts` - Native Node.js HTTP server for comparison
- `run.ts` - autocannon-based benchmark runner
- `run-oha.sh` - oha-based benchmark runner

## Notes

- Results may vary based on hardware and system load
- fetch-rs uses Rust (Axum/hyper/tokio) for HTTP handling with napi-rs bindings
- node-http uses Node.js native `http` module
