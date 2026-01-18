/**
 * Benchmark runner - compares fetch-rs with Node.js HTTP
 *
 * Usage: npx tsx benchmarks/run.ts [options]
 *
 * Options:
 *   --duration=<seconds>  Duration of each benchmark (default: 10)
 *   --connections=<n>     Number of concurrent connections (default: 100)
 *   --pipelining=<n>      Number of pipelined requests (default: 10)
 *   --scenario=<name>     Run specific scenario: json, text, echo, all (default: all)
 */

import autocannon from "autocannon";
import { spawn, ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

interface BenchmarkResult {
  server: string;
  scenario: string;
  requests: number;
  rps: number;
  latencyAvg: number;
  latencyP50: number;
  latencyP99: number;
  throughput: number;
  errors: number;
}

interface RunOptions {
  duration: number;
  connections: number;
  pipelining: number;
  scenario: string;
}

const FETCH_RS_PORT = 3000;
const NODE_HTTP_PORT = 3001;

function parseArgs(): RunOptions {
  const args = process.argv.slice(2);
  const options: RunOptions = {
    duration: 10,
    connections: 100,
    pipelining: 10,
    scenario: "all",
  };

  for (const arg of args) {
    if (arg.startsWith("--duration=")) {
      options.duration = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--connections=")) {
      options.connections = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--pipelining=")) {
      options.pipelining = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--scenario=")) {
      options.scenario = arg.split("=")[1];
    }
  }

  return options;
}

async function startServer(
  command: string,
  args: string[],
  port: number,
  name: string,
): Promise<ChildProcess> {
  console.log(`Starting ${name}...`);

  const proc = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(port) },
  });

  // Wait for server to start
  await new Promise<void>((resolve, reject) => {
    let started = false;
    const timeout = setTimeout(() => {
      reject(new Error(`${name} failed to start within 10 seconds`));
    }, 10000);

    proc.stdout?.on("data", (data) => {
      const output = data.toString();
      console.log(`  ${name}: ${output.trim()}`);
      // Match various server startup messages
      if (
        !started &&
        (output.includes("listening") || output.includes("starting") || output.includes("Server"))
      ) {
        started = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    proc.stderr?.on("data", (data) => {
      console.error(`${name} stderr:`, data.toString());
    });

    proc.on("error", (err) => {
      if (!started) {
        clearTimeout(timeout);
        reject(err);
      }
    });

    proc.on("exit", (code) => {
      // Only reject if server hasn't started yet and exit code indicates error
      if (!started && code !== 0 && code !== null) {
        clearTimeout(timeout);
        reject(new Error(`${name} exited with code ${code}`));
      }
    });
  });

  // Remove exit handler after startup to prevent issues during cleanup
  proc.removeAllListeners("exit");

  console.log(`${name} started on port ${port}`);
  return proc;
}

async function runBenchmark(
  url: string,
  options: RunOptions,
  body?: string,
): Promise<autocannon.Result> {
  const opts: autocannon.Options = {
    url,
    connections: options.connections,
    pipelining: options.pipelining,
    duration: options.duration,
  };

  if (body) {
    opts.method = "POST";
    opts.body = body;
    opts.headers = { "Content-Type": "text/plain" };
  }

  return new Promise((resolve, reject) => {
    const instance = autocannon(opts, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });

    // Don't print progress
    autocannon.track(instance, { renderProgressBar: false });
  });
}

function formatResult(
  server: string,
  scenario: string,
  result: autocannon.Result,
): BenchmarkResult {
  return {
    server,
    scenario,
    requests: result.requests.total,
    rps: Math.round(result.requests.average),
    latencyAvg: result.latency.average,
    latencyP50: result.latency.p50,
    latencyP99: result.latency.p99,
    throughput: Math.round((result.throughput.average / 1024 / 1024) * 100) / 100, // MB/s
    errors: result.errors,
  };
}

function printResults(results: BenchmarkResult[]) {
  console.log("\n" + "=".repeat(100));
  console.log("BENCHMARK RESULTS");
  console.log("=".repeat(100));

  // Group by scenario
  const scenarios = [...new Set(results.map((r) => r.scenario))];

  for (const scenario of scenarios) {
    console.log(`\n## ${scenario.toUpperCase()}`);
    console.log("-".repeat(100));
    console.log(
      "Server".padEnd(15) +
        "Requests".padStart(12) +
        "RPS".padStart(12) +
        "Lat Avg".padStart(12) +
        "Lat P50".padStart(12) +
        "Lat P99".padStart(12) +
        "Thru MB/s".padStart(12) +
        "Errors".padStart(10),
    );
    console.log("-".repeat(100));

    const scenarioResults = results.filter((r) => r.scenario === scenario);
    for (const r of scenarioResults) {
      console.log(
        r.server.padEnd(15) +
          r.requests.toLocaleString().padStart(12) +
          r.rps.toLocaleString().padStart(12) +
          (r.latencyAvg.toFixed(2) + "ms").padStart(12) +
          (r.latencyP50.toFixed(2) + "ms").padStart(12) +
          (r.latencyP99.toFixed(2) + "ms").padStart(12) +
          r.throughput.toFixed(2).padStart(12) +
          r.errors.toString().padStart(10),
      );
    }

    // Calculate comparison
    const fetchRs = scenarioResults.find((r) => r.server === "fetch-rs");
    const nodeHttp = scenarioResults.find((r) => r.server === "node-http");

    if (fetchRs && nodeHttp) {
      const rpsRatio = fetchRs.rps / nodeHttp.rps;
      const latencyRatio = nodeHttp.latencyAvg / fetchRs.latencyAvg;
      console.log("-".repeat(100));
      console.log(
        `Comparison: fetch-rs is ${rpsRatio.toFixed(2)}x RPS, ${latencyRatio.toFixed(2)}x lower latency vs node-http`,
      );
    }
  }

  console.log("\n" + "=".repeat(100));
}

async function main() {
  const options = parseArgs();

  console.log("Benchmark Configuration:");
  console.log(`  Duration: ${options.duration}s`);
  console.log(`  Connections: ${options.connections}`);
  console.log(`  Pipelining: ${options.pipelining}`);
  console.log(`  Scenario: ${options.scenario}`);
  console.log("");

  const results: BenchmarkResult[] = [];
  let fetchRsProc: ChildProcess | null = null;
  let nodeHttpProc: ChildProcess | null = null;

  try {
    // Start servers
    fetchRsProc = await startServer(
      "npx",
      ["tsx", "benchmarks/server-fetch-rs.ts"],
      FETCH_RS_PORT,
      "fetch-rs",
    );

    nodeHttpProc = await startServer(
      "npx",
      ["tsx", "benchmarks/server-node-http.ts"],
      NODE_HTTP_PORT,
      "node-http",
    );

    // Wait a bit for servers to fully initialize
    await sleep(500);

    const scenarios = options.scenario === "all" ? ["json", "text", "echo"] : [options.scenario];

    for (const scenario of scenarios) {
      console.log(`\nRunning ${scenario} benchmark...`);

      const body = scenario === "echo" ? "Hello, World!" : undefined;

      // Benchmark fetch-rs
      console.log(`  Benchmarking fetch-rs...`);
      const fetchRsResult = await runBenchmark(
        `http://localhost:${FETCH_RS_PORT}/${scenario}`,
        options,
        body,
      );
      results.push(formatResult("fetch-rs", scenario, fetchRsResult));

      // Benchmark node-http
      console.log(`  Benchmarking node-http...`);
      const nodeHttpResult = await runBenchmark(
        `http://localhost:${NODE_HTTP_PORT}/${scenario}`,
        options,
        body,
      );
      results.push(formatResult("node-http", scenario, nodeHttpResult));
    }

    // Print results
    printResults(results);
  } finally {
    // Cleanup
    console.log("\nStopping servers...");

    const killProcess = (proc: ChildProcess | null, name: string): Promise<void> => {
      if (!proc || proc.killed) return Promise.resolve();

      return new Promise((resolve) => {
        // Remove all listeners to prevent error events during shutdown
        proc.removeAllListeners();
        proc.stdout?.removeAllListeners();
        proc.stderr?.removeAllListeners();

        // Set up exit handler before killing
        proc.once("exit", () => resolve());
        proc.once("error", () => resolve());

        try {
          proc.kill("SIGKILL");
        } catch {
          console.log(`  Note: ${name} already stopped`);
          resolve();
        }

        // Timeout in case exit event doesn't fire
        setTimeout(resolve, 500);
      });
    };

    await Promise.all([
      killProcess(fetchRsProc, "fetch-rs"),
      killProcess(nodeHttpProc, "node-http"),
    ]);
  }
}

// Handle unhandled rejections (can happen when killing child processes)
process.on("unhandledRejection", () => {
  // Ignore - these can happen during cleanup
});

// Handle uncaught exceptions during cleanup
process.on("uncaughtException", () => {
  // Ignore - these can happen during cleanup
});

main()
  .then(() => {
    console.log("Benchmark complete.");
    // Use setImmediate to ensure all pending callbacks are processed
    setImmediate(() => {
      process.exitCode = 0;
      process.exit(0);
    });
  })
  .catch((err) => {
    console.error("Benchmark failed:", err);
    process.exitCode = 1;
    process.exit(1);
  });
