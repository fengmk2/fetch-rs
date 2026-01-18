# Benchmarks

Performance benchmarks comparing fetch-rs with native Node.js HTTP server.

## Environment

- **Machine**: Apple Silicon Mac
- **Node.js**: v22.x
- **Rust**: stable
- **napi-rs**: v3.8.2
- **Date**: 2026-01-18

## Results

### JSON Response Benchmark

Test endpoint returning `{"message": "Hello, World!"}`.

| Server | Requests | RPS | Latency Avg | Latency P50 | Latency P99 | Throughput |
|--------|----------|-----|-------------|-------------|-------------|------------|
| **fetch-rs** | 1,146,064 | **229,210** | **1.69ms** | 2.00ms | **3ms** | 29.51 MB/s |
| node-http | 745,454 | 149,107 | 2.92ms | 2.00ms | 5ms | 28.58 MB/s |

**fetch-rs is 1.54x faster in RPS and has 1.73x lower average latency**

### Text Response Benchmark

Test endpoint returning plain text `Hello, World!`.

| Server | Requests | RPS | Latency Avg | Latency P50 | Latency P99 | Throughput |
|--------|----------|-----|-------------|-------------|-------------|------------|
| **fetch-rs** | 1,129,904 | **226,010** | **1.71ms** | 2.00ms | **3ms** | 24.79 MB/s |
| node-http | 706,695 | 141,325 | 3.04ms | 2.00ms | 6ms | 24.26 MB/s |

**fetch-rs is 1.60x faster in RPS and has 1.78x lower average latency**

### Echo Body Benchmark

Test endpoint that echoes back the request body.

| Server | Requests | RPS | Latency Avg | Latency P50 | Latency P99 | Throughput |
|--------|----------|-----|-------------|-------------|-------------|------------|
| **fetch-rs** | 996,701 | **199,360** | **2.02ms** | 2.00ms | **4ms** | 16.92 MB/s |
| node-http | 614,106 | 122,822 | 3.61ms | 3.00ms | 7ms | 21.08 MB/s |

**fetch-rs is 1.62x faster in RPS and has 1.79x lower average latency**

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
