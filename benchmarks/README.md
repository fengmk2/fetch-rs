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
| **fetch-rs** | 1,065,959 | **213,158** | **1.86ms** | 2.00ms | **3ms** | 27.45 MB/s |
| node-http | 750,852 | 150,182 | 2.90ms | 2.00ms | 5ms | 28.79 MB/s |

**fetch-rs is 1.42x faster in RPS and has 1.56x lower average latency**

### Text Response Benchmark

Test endpoint returning plain text `Hello, World!`.

| Server | Requests | RPS | Latency Avg | Latency P50 | Latency P99 | Throughput |
|--------|----------|-----|-------------|-------------|-------------|------------|
| **fetch-rs** | 1,106,252 | **221,274** | **1.78ms** | 2.00ms | **3ms** | 24.26 MB/s |
| node-http | 747,817 | 149,568 | 2.89ms | 2.00ms | 5ms | 25.68 MB/s |

**fetch-rs is 1.48x faster in RPS and has 1.62x lower average latency**

### Echo Body Benchmark

Test endpoint that echoes back the request body.

| Server | Requests | RPS | Latency Avg | Latency P50 | Latency P99 | Throughput |
|--------|----------|-----|-------------|-------------|-------------|------------|
| **fetch-rs** | 944,499 | **188,890** | **2.15ms** | 2.00ms | **4ms** | 16.03 MB/s |
| node-http | 607,007 | 121,402 | 3.70ms | 3.00ms | 7ms | 20.84 MB/s |

**fetch-rs is 1.56x faster in RPS and has 1.72x lower average latency**

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
