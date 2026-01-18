import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { Server, Response } from "../../lib/index.js";

describe("Server E2E", () => {
  let server: Server;
  let baseUrl: string;
  const TEST_PORT = 13579; // Use a unique port to avoid conflicts

  beforeAll(() => {
    baseUrl = `http://localhost:${TEST_PORT}`;
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  describe("basic functionality", () => {
    it("should respond to a simple GET request", async () => {
      server = new Server({ port: TEST_PORT });

      server.addEventListener("fetch", (event) => {
        event.respondWith(new Response("Hello, World!"));
      });

      // Start server in background
      const listenPromise = server.listen();

      // Wait for server to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await fetch(`${baseUrl}/`);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(text).toBe("Hello, World!");

      // Close server
      await server.close();
      await listenPromise.catch(() => {}); // Ignore close errors
    });

    it("should handle JSON responses", async () => {
      server = new Server({ port: TEST_PORT });

      server.addEventListener("fetch", (event) => {
        event.respondWith(Response.json({ message: "Hello", count: 42 }));
      });

      const listenPromise = server.listen();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await fetch(`${baseUrl}/`);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");
      expect(json).toEqual({ message: "Hello", count: 42 });

      await server.close();
      await listenPromise.catch(() => {});
    });

    it("should handle different status codes", async () => {
      server = new Server({ port: TEST_PORT });

      server.addEventListener("fetch", (event) => {
        const url = new URL(event.request.url);
        if (url.pathname === "/not-found") {
          event.respondWith(new Response("Not Found", { status: 404 }));
        } else if (url.pathname === "/created") {
          event.respondWith(new Response("Created", { status: 201 }));
        } else {
          event.respondWith(new Response("OK"));
        }
      });

      const listenPromise = server.listen();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const okResponse = await fetch(`${baseUrl}/`);
      expect(okResponse.status).toBe(200);

      const notFoundResponse = await fetch(`${baseUrl}/not-found`);
      expect(notFoundResponse.status).toBe(404);

      const createdResponse = await fetch(`${baseUrl}/created`);
      expect(createdResponse.status).toBe(201);

      await server.close();
      await listenPromise.catch(() => {});
    });

    it("should handle custom headers", async () => {
      server = new Server({ port: TEST_PORT });

      server.addEventListener("fetch", (event) => {
        event.respondWith(
          new Response("OK", {
            headers: {
              "X-Custom-Header": "custom-value",
              "X-Request-Id": "12345",
            },
          }),
        );
      });

      const listenPromise = server.listen();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await fetch(`${baseUrl}/`);

      expect(response.headers.get("x-custom-header")).toBe("custom-value");
      expect(response.headers.get("x-request-id")).toBe("12345");

      await server.close();
      await listenPromise.catch(() => {});
    });
  });

  describe("request handling", () => {
    it("should receive request method", async () => {
      server = new Server({ port: TEST_PORT });
      let receivedMethod = "";

      server.addEventListener("fetch", (event) => {
        receivedMethod = event.request.method;
        event.respondWith(new Response("OK"));
      });

      const listenPromise = server.listen();
      await new Promise((resolve) => setTimeout(resolve, 100));

      await fetch(`${baseUrl}/`, { method: "POST" });
      expect(receivedMethod).toBe("POST");

      await fetch(`${baseUrl}/`, { method: "PUT" });
      expect(receivedMethod).toBe("PUT");

      await fetch(`${baseUrl}/`, { method: "DELETE" });
      expect(receivedMethod).toBe("DELETE");

      await server.close();
      await listenPromise.catch(() => {});
    });

    it("should receive request URL with path and query", async () => {
      server = new Server({ port: TEST_PORT });
      let receivedUrl = "";

      server.addEventListener("fetch", (event) => {
        receivedUrl = event.request.url;
        event.respondWith(new Response("OK"));
      });

      const listenPromise = server.listen();
      await new Promise((resolve) => setTimeout(resolve, 100));

      await fetch(`${baseUrl}/api/users?page=1&limit=10`);

      expect(receivedUrl).toContain("/api/users");
      expect(receivedUrl).toContain("page=1");
      expect(receivedUrl).toContain("limit=10");

      await server.close();
      await listenPromise.catch(() => {});
    });

    it("should receive request headers", async () => {
      server = new Server({ port: TEST_PORT });
      let receivedHeaders: Record<string, string | null> = {};

      server.addEventListener("fetch", (event) => {
        receivedHeaders = {
          "content-type": event.request.headers.get("content-type"),
          "x-custom": event.request.headers.get("x-custom"),
        };
        event.respondWith(new Response("OK"));
      });

      const listenPromise = server.listen();
      await new Promise((resolve) => setTimeout(resolve, 100));

      await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Custom": "test-value",
        },
        body: "{}",
      });

      expect(receivedHeaders["content-type"]).toBe("application/json");
      expect(receivedHeaders["x-custom"]).toBe("test-value");

      await server.close();
      await listenPromise.catch(() => {});
    });

    it("should receive and parse request body as text", async () => {
      server = new Server({ port: TEST_PORT });
      let receivedBody = "";

      server.addEventListener("fetch", async (event) => {
        receivedBody = await event.request.text();
        event.respondWith(new Response("OK"));
      });

      const listenPromise = server.listen();
      await new Promise((resolve) => setTimeout(resolve, 100));

      await fetch(`${baseUrl}/`, {
        method: "POST",
        body: "Hello, Server!",
      });

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedBody).toBe("Hello, Server!");

      await server.close();
      await listenPromise.catch(() => {});
    });

    it("should receive and parse request body as JSON", async () => {
      server = new Server({ port: TEST_PORT });
      let receivedJson: any = null;

      server.addEventListener("fetch", async (event) => {
        receivedJson = await event.request.json();
        event.respondWith(new Response("OK"));
      });

      const listenPromise = server.listen();
      await new Promise((resolve) => setTimeout(resolve, 100));

      await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "John", age: 30 }),
      });

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedJson).toEqual({ name: "John", age: 30 });

      await server.close();
      await listenPromise.catch(() => {});
    });

    it("should receive client address", async () => {
      server = new Server({ port: TEST_PORT });
      let clientAddress = "";

      server.addEventListener("fetch", (event) => {
        clientAddress = event.clientAddress;
        event.respondWith(new Response("OK"));
      });

      const listenPromise = server.listen();
      await new Promise((resolve) => setTimeout(resolve, 100));

      await fetch(`${baseUrl}/`);

      // Client address should be set (127.0.0.1 or ::1 for localhost)
      expect(clientAddress).toBeTruthy();
      expect(clientAddress).toMatch(/127\.0\.0\.1|::1/);

      await server.close();
      await listenPromise.catch(() => {});
    });
  });

  describe("echo server", () => {
    it("should echo request body back", async () => {
      server = new Server({ port: TEST_PORT });

      server.addEventListener("fetch", async (event) => {
        const body = await event.request.text();
        event.respondWith(new Response(body));
      });

      const listenPromise = server.listen();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await fetch(`${baseUrl}/`, {
        method: "POST",
        body: "Echo this back!",
      });
      const text = await response.text();

      expect(text).toBe("Echo this back!");

      await server.close();
      await listenPromise.catch(() => {});
    });

    it("should echo JSON and add metadata", async () => {
      server = new Server({ port: TEST_PORT });

      server.addEventListener("fetch", async (event) => {
        const json = await event.request.json();
        event.respondWith(
          Response.json({
            received: json,
            method: event.request.method,
          }),
        );
      });

      const listenPromise = server.listen();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello" }),
      });
      const json = await response.json();

      expect(json).toEqual({
        received: { message: "Hello" },
        method: "POST",
      });

      await server.close();
      await listenPromise.catch(() => {});
    });
  });

  describe("routing", () => {
    it("should route based on pathname", async () => {
      server = new Server({ port: TEST_PORT });

      server.addEventListener("fetch", (event) => {
        const url = new URL(event.request.url);

        switch (url.pathname) {
          case "/api/health":
            event.respondWith(Response.json({ status: "ok" }));
            break;
          case "/api/users":
            event.respondWith(Response.json({ users: [] }));
            break;
          default:
            event.respondWith(new Response("Not Found", { status: 404 }));
        }
      });

      const listenPromise = server.listen();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const healthResponse = await fetch(`${baseUrl}/api/health`);
      expect(await healthResponse.json()).toEqual({ status: "ok" });

      const usersResponse = await fetch(`${baseUrl}/api/users`);
      expect(await usersResponse.json()).toEqual({ users: [] });

      const notFoundResponse = await fetch(`${baseUrl}/unknown`);
      expect(notFoundResponse.status).toBe(404);

      await server.close();
      await listenPromise.catch(() => {});
    });
  });

  describe("server stats", () => {
    it("should track request statistics", async () => {
      server = new Server({ port: TEST_PORT });

      server.addEventListener("fetch", (event) => {
        event.respondWith(new Response("OK"));
      });

      const listenPromise = server.listen();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Make several requests
      await fetch(`${baseUrl}/`);
      await fetch(`${baseUrl}/`);
      await fetch(`${baseUrl}/`);

      const stats = server.stats();

      expect(stats.totalRequests).toBeGreaterThanOrEqual(3);
      expect(stats.avgLatencyMs).toBeGreaterThanOrEqual(0);

      await server.close();
      await listenPromise.catch(() => {});
    });
  });

  describe("error handling", () => {
    it("should handle handler errors gracefully", async () => {
      server = new Server({ port: TEST_PORT });

      server.addEventListener("fetch", () => {
        throw new Error("Handler error");
      });

      const listenPromise = server.listen();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // The server should still respond (with timeout since handler didn't call respondWith)
      // This tests that the server doesn't crash on handler errors
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      try {
        await fetch(`${baseUrl}/`, { signal: controller.signal });
      } catch {
        // Expected to timeout or abort
      }

      clearTimeout(timeoutId);

      await server.close();
      await listenPromise.catch(() => {});
    });

    it("should handle async handler errors", async () => {
      server = new Server({ port: TEST_PORT });

      server.addEventListener("fetch", (event) => {
        event.respondWith(Promise.reject(new Error("Async error")));
      });

      const listenPromise = server.listen();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await fetch(`${baseUrl}/`);

      // Should get 500 error response
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toContain("Internal Server Error");

      await server.close();
      await listenPromise.catch(() => {});
    });
  });
});
