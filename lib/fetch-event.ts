/**
 * WinterCG-compatible Fetch Event API implementation
 *
 * This module provides Request, Response, Headers, and FetchEvent classes
 * compatible with the Service Worker / Cloudflare Workers Fetch Event pattern.
 */

import type { RequestContext, JsResponse, JsHeader, HeaderPair } from "../index.js";

/**
 * Headers class - WinterCG compatible Headers implementation
 */
export class Headers implements Iterable<[string, string]> {
  private _headers: Map<string, string>;

  constructor(init?: HeadersInit | Headers | Array<[string, string]> | HeaderPair[]) {
    this._headers = new Map();

    if (init) {
      if (init instanceof Headers) {
        for (const [key, value] of init) {
          this._headers.set(key.toLowerCase(), value);
        }
      } else if (Array.isArray(init)) {
        for (const item of init) {
          if (Array.isArray(item)) {
            // Tuple format: [name, value]
            this._headers.set(item[0].toLowerCase(), item[1]);
          } else if (typeof item === "object" && "name" in item && "value" in item) {
            // HeaderPair format: { name, value }
            this._headers.set(item.name.toLowerCase(), item.value);
          }
        }
      } else if (typeof init === "object") {
        for (const [key, value] of Object.entries(init)) {
          this._headers.set(key.toLowerCase(), value);
        }
      }
    }
  }

  append(name: string, value: string): void {
    const key = name.toLowerCase();
    const existing = this._headers.get(key);
    if (existing) {
      this._headers.set(key, `${existing}, ${value}`);
    } else {
      this._headers.set(key, value);
    }
  }

  delete(name: string): void {
    this._headers.delete(name.toLowerCase());
  }

  get(name: string): string | null {
    return this._headers.get(name.toLowerCase()) ?? null;
  }

  has(name: string): boolean {
    return this._headers.has(name.toLowerCase());
  }

  set(name: string, value: string): void {
    this._headers.set(name.toLowerCase(), value);
  }

  entries(): IterableIterator<[string, string]> {
    return this._headers.entries();
  }

  keys(): IterableIterator<string> {
    return this._headers.keys();
  }

  values(): IterableIterator<string> {
    return this._headers.values();
  }

  forEach(callback: (value: string, key: string, parent: Headers) => void): void {
    this._headers.forEach((value, key) => callback(value, key, this));
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this._headers.entries();
  }

  /**
   * Convert to array of [name, value] tuples for Rust
   */
  toArray(): Array<[string, string]> {
    return Array.from(this._headers.entries());
  }

  /**
   * Convert to JsHeader array for Rust response
   */
  toJsHeaders(): JsHeader[] {
    return Array.from(this._headers.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }
}

type HeadersInit = Record<string, string> | Array<[string, string]>;

/**
 * Request class - WinterCG compatible Request implementation
 */
export class Request {
  readonly method: string;
  readonly url: string;
  readonly headers: Headers;
  private _body: Buffer | null;
  private _bodyUsed: boolean = false;

  constructor(input: string | URL | Request, init?: RequestInit) {
    if (input instanceof Request) {
      this.method = init?.method ?? input.method;
      this.url = input.url;
      this.headers = new Headers(init?.headers ?? input.headers);
      this._body = input._body;
    } else {
      const url = input instanceof URL ? input.toString() : input;
      this.method = init?.method ?? "GET";
      this.url = url;
      this.headers = new Headers(init?.headers);
      this._body = init?.body ? Buffer.from(init.body as string | Buffer) : null;
    }
  }

  get bodyUsed(): boolean {
    return this._bodyUsed;
  }

  get body(): ReadableStream<Uint8Array> | null {
    // Simple implementation - convert buffer to stream
    if (!this._body) return null;

    const buffer = this._body;
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(buffer));
        controller.close();
      },
    });
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    this._checkBodyUsed();
    this._bodyUsed = true;
    if (!this._body) return new ArrayBuffer(0);
    // Create a copy as ArrayBuffer
    const ab = new ArrayBuffer(this._body.byteLength);
    const view = new Uint8Array(ab);
    view.set(new Uint8Array(this._body));
    return ab;
  }

  async text(): Promise<string> {
    this._checkBodyUsed();
    this._bodyUsed = true;
    if (!this._body) return "";
    return this._body.toString("utf-8");
  }

  async json<T = unknown>(): Promise<T> {
    const text = await this.text();
    return JSON.parse(text);
  }

  async blob(): Promise<Blob> {
    this._checkBodyUsed();
    this._bodyUsed = true;
    if (!this._body) return new Blob([]);
    return new Blob([new Uint8Array(this._body)]);
  }

  async formData(): Promise<FormData> {
    // Basic FormData parsing - would need more complete implementation
    throw new Error("FormData parsing not yet implemented");
  }

  clone(): Request {
    if (this._bodyUsed) {
      throw new TypeError("Cannot clone a Request whose body has been used");
    }
    return new Request(this.url, {
      method: this.method,
      headers: this.headers,
      body: this._body ?? undefined,
    });
  }

  private _checkBodyUsed(): void {
    if (this._bodyUsed) {
      throw new TypeError("Body has already been consumed");
    }
  }

  /**
   * Create a Request from a RequestContext (internal use)
   */
  static _fromContext(ctx: RequestContext): Request {
    const request = new Request(ctx.url, {
      method: ctx.method,
      headers: ctx.headers,
    });
    request._body = ctx.body ?? null;
    return request;
  }
}

interface RequestInit {
  method?: string;
  headers?: HeadersInit | Headers | HeaderPair[];
  body?: string | Buffer | ArrayBuffer | Uint8Array;
}

/**
 * Response class - WinterCG compatible Response implementation
 */
export class Response {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  private _body: Buffer | null;
  private _bodyUsed: boolean = false;

  constructor(body?: BodyInit | null, init?: ResponseInit) {
    this.status = init?.status ?? 200;
    this.statusText = init?.statusText ?? "OK";
    this.headers = new Headers(init?.headers);

    if (body === null || body === undefined) {
      this._body = null;
    } else if (typeof body === "string") {
      this._body = Buffer.from(body);
    } else if (Buffer.isBuffer(body)) {
      this._body = body;
    } else if (body instanceof ArrayBuffer) {
      this._body = Buffer.from(body);
    } else if (body instanceof Uint8Array) {
      this._body = Buffer.from(body);
    } else {
      this._body = Buffer.from(String(body));
    }
  }

  get ok(): boolean {
    return this.status >= 200 && this.status < 300;
  }

  get bodyUsed(): boolean {
    return this._bodyUsed;
  }

  get body(): ReadableStream<Uint8Array> | null {
    if (!this._body) return null;

    const buffer = this._body;
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(buffer));
        controller.close();
      },
    });
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    this._checkBodyUsed();
    this._bodyUsed = true;
    if (!this._body) return new ArrayBuffer(0);
    // Create a copy as ArrayBuffer
    const ab = new ArrayBuffer(this._body.byteLength);
    const view = new Uint8Array(ab);
    view.set(new Uint8Array(this._body));
    return ab;
  }

  async text(): Promise<string> {
    this._checkBodyUsed();
    this._bodyUsed = true;
    if (!this._body) return "";
    return this._body.toString("utf-8");
  }

  async json<T = unknown>(): Promise<T> {
    const text = await this.text();
    return JSON.parse(text);
  }

  async blob(): Promise<Blob> {
    this._checkBodyUsed();
    this._bodyUsed = true;
    if (!this._body) return new Blob([]);
    return new Blob([new Uint8Array(this._body)]);
  }

  async formData(): Promise<FormData> {
    throw new Error("FormData parsing not yet implemented");
  }

  clone(): Response {
    if (this._bodyUsed) {
      throw new TypeError("Cannot clone a Response whose body has been used");
    }
    return new Response(this._body, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
    });
  }

  private _checkBodyUsed(): void {
    if (this._bodyUsed) {
      throw new TypeError("Body has already been consumed");
    }
  }

  /**
   * Create a JSON response
   */
  static json(data: unknown, init?: ResponseInit): Response {
    const body = JSON.stringify(data);
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");

    return new Response(body, {
      ...init,
      headers,
    });
  }

  /**
   * Create a redirect response
   */
  static redirect(url: string, status: number = 302): Response {
    if (![301, 302, 303, 307, 308].includes(status)) {
      throw new RangeError(`Invalid redirect status: ${status}`);
    }

    return new Response(null, {
      status,
      headers: { location: url },
    });
  }

  /**
   * Create an error response
   */
  static error(): Response {
    const response = new Response(null, { status: 0 });
    return response;
  }

  /**
   * Convert to JsResponse for Rust (internal use)
   */
  _toJsResponse(): JsResponse {
    return {
      status: this.status,
      headers: this.headers.toJsHeaders(),
      body: this._body ?? undefined,
    };
  }
}

type BodyInit = string | Buffer | ArrayBuffer | Uint8Array;

interface ResponseInit {
  status?: number;
  statusText?: string;
  headers?: HeadersInit | Headers;
}

/**
 * FetchEvent class - Service Worker compatible FetchEvent
 */
export class FetchEvent {
  readonly request: Request;
  readonly clientAddress: string;
  private _responded: boolean = false;
  private _respondCallback: (response: JsResponse) => void;
  private _waitUntilPromises: Promise<unknown>[] = [];

  constructor(
    request: Request,
    clientAddress: string,
    respondCallback: (response: JsResponse) => void,
  ) {
    this.request = request;
    this.clientAddress = clientAddress;
    this._respondCallback = respondCallback;
  }

  /**
   * Respond to the request with a Response or Promise<Response>
   * Must be called exactly once per event
   */
  respondWith(response: Response | Promise<Response>): void {
    if (this._responded) {
      throw new Error("respondWith() has already been called");
    }
    this._responded = true;

    let responseSent = false;

    Promise.resolve(response)
      .then((res) => {
        this._respondCallback(res._toJsResponse());
        responseSent = true;
      })
      .catch((error: Error) => {
        // Only try to send error response if we haven't already sent one
        if (responseSent) {
          // Response was already sent, just log the error
          console.error("Error after response sent:", error);
          return;
        }
        try {
          const errorResponse = new Response(`Internal Server Error: ${error.message}`, {
            status: 500,
          });
          this._respondCallback(errorResponse._toJsResponse());
        } catch (sendError) {
          // Failed to send error response, log and ignore
          console.error("Failed to send error response:", sendError);
        }
      });
  }

  /**
   * Extend the event lifetime for background tasks
   * The response is sent immediately, but the event stays alive
   */
  waitUntil(promise: Promise<unknown>): void {
    this._waitUntilPromises.push(promise);
  }

  /**
   * Get all waitUntil promises (internal use)
   */
  _getWaitUntilPromises(): Promise<unknown>[] {
    return this._waitUntilPromises;
  }

  /**
   * Create a FetchEvent from a RequestContext (internal use)
   */
  static _fromContext(ctx: RequestContext): FetchEvent {
    const request = Request._fromContext(ctx);
    return new FetchEvent(request, ctx.clientAddress, (response) => {
      ctx.respond(response);
    });
  }
}

/**
 * Fetch event handler type
 */
export type FetchEventHandler = (event: FetchEvent) => void | Promise<void>;
