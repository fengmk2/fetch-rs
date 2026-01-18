#!/bin/bash

# Benchmark runner using oha (Rust HTTP load generator)
#
# Install oha: cargo install oha
#
# Usage: ./benchmarks/run-oha.sh [duration] [connections]
#   duration: seconds (default: 10)
#   connections: concurrent connections (default: 100)

set -e

DURATION=${1:-10}
CONNECTIONS=${2:-100}
FETCH_RS_PORT=3000
NODE_HTTP_PORT=3001

echo "=============================================="
echo "Benchmark Configuration"
echo "=============================================="
echo "Duration: ${DURATION}s"
echo "Connections: ${CONNECTIONS}"
echo ""

# Check if oha is installed
if ! command -v oha &> /dev/null; then
    echo "oha is not installed. Install with: cargo install oha"
    echo "Falling back to autocannon..."
    exec npx tsx benchmarks/run.ts --duration=$DURATION --connections=$CONNECTIONS
fi

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "Stopping servers..."
    kill $FETCH_RS_PID 2>/dev/null || true
    kill $NODE_HTTP_PID 2>/dev/null || true
    wait 2>/dev/null || true
}
trap cleanup EXIT

# Start fetch-rs server
echo "Starting fetch-rs server..."
PORT=$FETCH_RS_PORT npx tsx benchmarks/server-fetch-rs.ts &
FETCH_RS_PID=$!
sleep 2

# Start node-http server
echo "Starting node-http server..."
PORT=$NODE_HTTP_PORT npx tsx benchmarks/server-node-http.ts &
NODE_HTTP_PID=$!
sleep 2

echo ""
echo "=============================================="
echo "JSON Response Benchmark"
echo "=============================================="

echo ""
echo "--- fetch-rs /json ---"
oha -c $CONNECTIONS -z ${DURATION}s --no-tui http://localhost:$FETCH_RS_PORT/json

echo ""
echo "--- node-http /json ---"
oha -c $CONNECTIONS -z ${DURATION}s --no-tui http://localhost:$NODE_HTTP_PORT/json

echo ""
echo "=============================================="
echo "Text Response Benchmark"
echo "=============================================="

echo ""
echo "--- fetch-rs /text ---"
oha -c $CONNECTIONS -z ${DURATION}s --no-tui http://localhost:$FETCH_RS_PORT/text

echo ""
echo "--- node-http /text ---"
oha -c $CONNECTIONS -z ${DURATION}s --no-tui http://localhost:$NODE_HTTP_PORT/text

echo ""
echo "=============================================="
echo "Echo Body Benchmark"
echo "=============================================="

echo ""
echo "--- fetch-rs /echo ---"
oha -c $CONNECTIONS -z ${DURATION}s -m POST -d '{"test":"data"}' -H "Content-Type: application/json" --no-tui http://localhost:$FETCH_RS_PORT/echo

echo ""
echo "--- node-http /echo ---"
oha -c $CONNECTIONS -z ${DURATION}s -m POST -d '{"test":"data"}' -H "Content-Type: application/json" --no-tui http://localhost:$NODE_HTTP_PORT/echo

echo ""
echo "=============================================="
echo "Benchmark Complete"
echo "=============================================="
