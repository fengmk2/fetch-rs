/**
 * Server wrapper class that provides the addEventListener API
 */

import { Server as NativeServer } from '../index.js';
import { FetchEvent, type FetchEventHandler } from './fetch-event.js';

/**
 * Server configuration options
 */
export interface ServerOptions {
  /** Port to listen on */
  port: number;
  /** Host to bind to (default: '0.0.0.0') */
  host?: string;
  /** Enable SO_REUSEPORT for multi-core scaling */
  reusePort?: boolean;
  /** Maximum concurrent connections (default: 65536) */
  maxConnections?: number;
  /** Request body size limit in bytes (default: 10MB) */
  maxBodySize?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Server statistics
 */
export interface ServerStats {
  /** Number of active connections */
  activeConnections: number;
  /** Total requests handled */
  totalRequests: number;
  /** Requests per second (rolling average) */
  requestsPerSecond: number;
  /** Average latency in milliseconds */
  avgLatencyMs: number;
}

/**
 * High-performance HTTP server with Fetch Event API
 *
 * @example
 * ```typescript
 * import { Server, Response } from 'fetch-rs';
 *
 * const server = new Server({ port: 3000 });
 *
 * server.addEventListener('fetch', (event) => {
 *   event.respondWith(new Response('Hello, World!'));
 * });
 *
 * await server.listen();
 * ```
 */
export class Server {
  private _native: NativeServer;
  private _handlers: FetchEventHandler[] = [];
  private _options: ServerOptions;

  constructor(options: ServerOptions) {
    this._options = options;
    this._native = new NativeServer({
      port: options.port,
      host: options.host,
      reusePort: options.reusePort,
      maxConnections: options.maxConnections,
      maxBodySize: options.maxBodySize,
      timeout: options.timeout,
    });
  }

  /**
   * Register a fetch event handler
   *
   * @param event - Must be 'fetch'
   * @param handler - The handler function
   */
  addEventListener(event: 'fetch', handler: FetchEventHandler): void {
    if (event !== 'fetch') {
      throw new Error(`Unknown event type: ${event}`);
    }
    this._handlers.push(handler);
  }

  /**
   * Remove a fetch event handler
   *
   * @param event - Must be 'fetch'
   * @param handler - The handler function to remove
   */
  removeEventListener(event: 'fetch', handler: FetchEventHandler): void {
    if (event !== 'fetch') {
      throw new Error(`Unknown event type: ${event}`);
    }
    const index = this._handlers.indexOf(handler);
    if (index !== -1) {
      this._handlers.splice(index, 1);
    }
  }

  /**
   * Start the server and begin accepting connections
   */
  async listen(): Promise<void> {
    if (this._handlers.length === 0) {
      throw new Error('No fetch handler registered. Call addEventListener("fetch", handler) before listen()');
    }

    // Set up the native handler that dispatches to JS handlers
    this._native.setHandler((ctx) => {
      const event = FetchEvent._fromContext(ctx);

      // Call all registered handlers
      for (const handler of this._handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in fetch handler:', error);
        }
      }
    });

    console.log(`Server starting on http://${this._options.host || '0.0.0.0'}:${this._options.port}`);
    await this._native.listen();
  }

  /**
   * Gracefully shutdown the server
   */
  async close(): Promise<void> {
    await this._native.close();
  }

  /**
   * Get current server statistics
   */
  stats(): ServerStats {
    const native = this._native.stats();
    return {
      activeConnections: native.activeConnections,
      totalRequests: Number(native.totalRequests),
      requestsPerSecond: native.requestsPerSecond,
      avgLatencyMs: native.avgLatencyMs,
    };
  }

  /**
   * Get the server port
   */
  get port(): number {
    return this._options.port;
  }

  /**
   * Get the server host
   */
  get host(): string {
    return this._options.host || '0.0.0.0';
  }
}
