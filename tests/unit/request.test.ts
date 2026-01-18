import { describe, it, expect } from "vitest";
import { Request, Headers } from "../../lib/fetch-event.js";

describe("Request", () => {
  describe("constructor", () => {
    it("should create a GET request from URL string", () => {
      const request = new Request("https://example.com/api/users");
      expect(request.method).toBe("GET");
      expect(request.url).toBe("https://example.com/api/users");
    });

    it("should create a GET request from URL object", () => {
      const url = new URL("https://example.com/api/users");
      const request = new Request(url);
      expect(request.method).toBe("GET");
      expect(request.url).toBe("https://example.com/api/users");
    });

    it("should create a POST request with method option", () => {
      const request = new Request("https://example.com/api/users", {
        method: "POST",
      });
      expect(request.method).toBe("POST");
    });

    it("should create a request with headers object", () => {
      const request = new Request("https://example.com", {
        headers: { "Content-Type": "application/json" },
      });
      expect(request.headers.get("content-type")).toBe("application/json");
    });

    it("should create a request with Headers instance", () => {
      const headers = new Headers({ "X-Custom": "value" });
      const request = new Request("https://example.com", { headers });
      expect(request.headers.get("x-custom")).toBe("value");
    });

    it("should create a request with body", () => {
      const request = new Request("https://example.com", {
        method: "POST",
        body: "hello world",
      });
      expect(request.bodyUsed).toBe(false);
    });

    it("should clone another Request", () => {
      const original = new Request("https://example.com", {
        method: "POST",
        headers: { "X-Test": "value" },
      });
      const cloned = new Request(original);
      expect(cloned.method).toBe("POST");
      expect(cloned.url).toBe("https://example.com");
      expect(cloned.headers.get("x-test")).toBe("value");
    });

    it("should override properties when cloning with init", () => {
      const original = new Request("https://example.com", { method: "GET" });
      const cloned = new Request(original, { method: "POST" });
      expect(cloned.method).toBe("POST");
    });
  });

  describe("body methods", () => {
    it("should return empty string for text() with no body", async () => {
      const request = new Request("https://example.com");
      const text = await request.text();
      expect(text).toBe("");
    });

    it("should parse text body", async () => {
      const request = new Request("https://example.com", {
        method: "POST",
        body: "hello world",
      });
      const text = await request.text();
      expect(text).toBe("hello world");
    });

    it("should parse JSON body", async () => {
      const request = new Request("https://example.com", {
        method: "POST",
        body: '{"name":"John","age":30}',
      });
      const json = await request.json<{ name: string; age: number }>();
      expect(json).toEqual({ name: "John", age: 30 });
    });

    it("should return ArrayBuffer", async () => {
      const request = new Request("https://example.com", {
        method: "POST",
        body: "test",
      });
      const buffer = await request.arrayBuffer();
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBe(4);
    });

    it("should return Blob", async () => {
      const request = new Request("https://example.com", {
        method: "POST",
        body: "test",
      });
      const blob = await request.blob();
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBe(4);
    });

    it("should throw when body already consumed", async () => {
      const request = new Request("https://example.com", {
        method: "POST",
        body: "test",
      });
      await request.text();
      expect(request.bodyUsed).toBe(true);
      await expect(request.text()).rejects.toThrow("Body has already been consumed");
    });

    it("should throw for formData() (not implemented)", async () => {
      const request = new Request("https://example.com", {
        method: "POST",
        body: "test",
      });
      await expect(request.formData()).rejects.toThrow("FormData parsing not yet implemented");
    });
  });

  describe("body property", () => {
    it("should return null when no body", () => {
      const request = new Request("https://example.com");
      expect(request.body).toBeNull();
    });

    it("should return ReadableStream when body exists", () => {
      const request = new Request("https://example.com", {
        method: "POST",
        body: "test",
      });
      expect(request.body).toBeInstanceOf(ReadableStream);
    });
  });

  describe("clone", () => {
    it("should clone a request", () => {
      const request = new Request("https://example.com", {
        method: "POST",
        headers: { "X-Test": "value" },
        body: "test body",
      });
      const cloned = request.clone();
      expect(cloned.method).toBe("POST");
      expect(cloned.url).toBe("https://example.com");
      expect(cloned.headers.get("x-test")).toBe("value");
    });

    it("should throw when cloning consumed request", async () => {
      const request = new Request("https://example.com", {
        method: "POST",
        body: "test",
      });
      await request.text();
      expect(() => request.clone()).toThrow("Cannot clone a Request whose body has been used");
    });
  });
});
