# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

fetch-rs is a high-performance HTTP server for Node.js, powered by Rust and napi-rs. It provides a WinterCG-compatible Fetch Event API (similar to Cloudflare Workers and Service Workers) while achieving 1.4-1.6x the performance of Node.js native HTTP server.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Node.js (JavaScript/TypeScript)         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  FetchEvent, Request, Response, Headers classes         ││
│  │  (lib/fetch-event.ts)                                   ││
│  └─────────────────────────────────────────────────────────┘│
│                             ▲                                │
│                             │ ThreadsafeFunction callback    │
│                             ▼                                │
├─────────────────────────────────────────────────────────────┤
│                      napi-rs binding layer                   │
│  (src/lib.rs, src/request.rs, src/response.rs)              │
├─────────────────────────────────────────────────────────────┤
│                      Rust HTTP Server                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Axum + Hyper + Tokio                                   ││
│  │  (src/server.rs)                                        ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Key components:**

- **Rust layer** (`src/`): HTTP server using Axum/Hyper/Tokio stack, handles all I/O
- **napi-rs bindings**: Zero-copy data transfer between Rust and Node.js via `Buffer` and `ThreadsafeFunction`
- **TypeScript layer** (`lib/`): WinterCG-compatible Fetch Event API (Request, Response, Headers, FetchEvent classes)

## Common Commands

```bash
# Install dependencies
pnpm install

# Build (Rust native + TypeScript)
pnpm run build

# Build debug version (faster compilation)
pnpm run build:debug

# Run tests
pnpm test

# Run benchmarks
pnpm bench              # Full benchmark
pnpm bench:quick        # Quick benchmark (5s duration, 50 connections)

# Run examples
npx tsx examples/hello-world.ts
npx tsx examples/json-api.ts
npx tsx examples/echo-body.ts

# Lint and format (Rust)
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings

# Lint and format (TypeScript)
pnpm lint               # Run oxlint with type checking
pnpm lint:fix           # Auto-fix lint issues
pnpm fmt                # Format code with oxfmt
pnpm fmt:check          # Check formatting
```

## Project Structure

```
fetch-rs/
├── src/                    # Rust source code
│   ├── lib.rs             # napi-rs entry point, Server class
│   ├── server.rs          # Axum HTTP server implementation
│   ├── request.rs         # RequestContext, HeaderPair, BodyHandle
│   └── response.rs        # JsResponse, JsHeader
├── lib/                    # TypeScript source code
│   ├── index.ts           # Main exports
│   ├── server.ts          # FetchServer wrapper class
│   └── fetch-event.ts     # FetchEvent, Request, Response, Headers
├── examples/              # Example servers
├── benchmarks/            # Performance benchmarks
├── Cargo.toml             # Rust dependencies
├── package.json           # Node.js dependencies
└── tsconfig.json          # TypeScript config
```

## Key Technical Details

### napi-rs v3 API

- `ThreadsafeFunction<T, ()>` for async callbacks (no `ErrorStrategy` in v3)
- `ThreadsafeFunction` must be wrapped in `Arc` (doesn't implement `Clone`)
- Callback signature: `(err: Error | null, ctx: T) => void`
- `Buffer` for zero-copy data transfer (doesn't implement `Clone`)

### Request Flow

1. HTTP request arrives at Rust server (Axum)
2. Rust creates `RequestContext` with method, url, headers, body
3. Rust calls JS handler via `ThreadsafeFunction`
4. JS creates `FetchEvent` with `Request` object
5. User calls `event.respondWith(response)`
6. JS converts `Response` to `JsResponse` and sends back via oneshot channel
7. Rust sends HTTP response

### Module Format

- Project uses ESM (`"type": "module"` in package.json)
- Native binary built with `--esm` flag via napi-rs
- TypeScript compiles to ES modules

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch
```

Tests are located in `test/` directory using Vitest.

## Benchmarking

The benchmark compares fetch-rs against Node.js native HTTP server:

```bash
pnpm bench:quick   # Quick run (recommended for development)
pnpm bench         # Full benchmark with more iterations
```

Benchmark scenarios:

- **JSON**: JSON serialization response
- **Text**: Plain text response
- **Echo**: Echo request body back

## CI/CD

GitHub Actions workflows:

- **CI** (`.github/workflows/ci.yml`): Tests on Linux/macOS/Windows + Rust/TypeScript lint
- **Benchmark** (`.github/workflows/benchmark.yml`): Runs benchmarks on PRs with comment

## Important Notes

- Do not include Co-Authored-By line in git commit messages
- Do not auto-commit or auto-push unless explicitly asked
- When adding npm packages, use `npm view <package> --json` to find latest version
- Use `pnpm` as the package manager (specified in `packageManager` field)
