import { describe, it, expect } from "vitest";
import { Headers } from "../../lib/fetch-event.js";

describe("Headers", () => {
  describe("constructor", () => {
    it("should create empty headers", () => {
      const headers = new Headers();
      expect(headers.get("content-type")).toBeNull();
    });

    it("should create headers from object", () => {
      const headers = new Headers({
        "Content-Type": "application/json",
        "X-Custom": "value",
      });
      expect(headers.get("content-type")).toBe("application/json");
      expect(headers.get("x-custom")).toBe("value");
    });

    it("should create headers from array of tuples", () => {
      const headers = new Headers([
        ["Content-Type", "text/plain"],
        ["Accept", "application/json"],
      ]);
      expect(headers.get("content-type")).toBe("text/plain");
      expect(headers.get("accept")).toBe("application/json");
    });

    it("should create headers from HeaderPair array", () => {
      const headers = new Headers([
        { name: "Content-Type", value: "text/html" },
        { name: "Cache-Control", value: "no-cache" },
      ]);
      expect(headers.get("content-type")).toBe("text/html");
      expect(headers.get("cache-control")).toBe("no-cache");
    });

    it("should create headers from another Headers instance", () => {
      const original = new Headers({ "X-Test": "value" });
      const copy = new Headers(original);
      expect(copy.get("x-test")).toBe("value");
    });

    it("should normalize header names to lowercase", () => {
      const headers = new Headers({ "CONTENT-TYPE": "text/plain" });
      expect(headers.get("content-type")).toBe("text/plain");
      expect(headers.get("CONTENT-TYPE")).toBe("text/plain");
    });
  });

  describe("get", () => {
    it("should return null for non-existent header", () => {
      const headers = new Headers();
      expect(headers.get("x-not-found")).toBeNull();
    });

    it("should be case-insensitive", () => {
      const headers = new Headers({ "Content-Type": "text/plain" });
      expect(headers.get("content-type")).toBe("text/plain");
      expect(headers.get("Content-Type")).toBe("text/plain");
      expect(headers.get("CONTENT-TYPE")).toBe("text/plain");
    });
  });

  describe("set", () => {
    it("should set a new header", () => {
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      expect(headers.get("content-type")).toBe("application/json");
    });

    it("should overwrite existing header", () => {
      const headers = new Headers({ "Content-Type": "text/plain" });
      headers.set("Content-Type", "application/json");
      expect(headers.get("content-type")).toBe("application/json");
    });
  });

  describe("append", () => {
    it("should append to new header", () => {
      const headers = new Headers();
      headers.append("Accept", "text/html");
      expect(headers.get("accept")).toBe("text/html");
    });

    it("should append to existing header with comma", () => {
      const headers = new Headers({ Accept: "text/html" });
      headers.append("Accept", "application/json");
      expect(headers.get("accept")).toBe("text/html, application/json");
    });
  });

  describe("has", () => {
    it("should return true for existing header", () => {
      const headers = new Headers({ "Content-Type": "text/plain" });
      expect(headers.has("content-type")).toBe(true);
      expect(headers.has("Content-Type")).toBe(true);
    });

    it("should return false for non-existent header", () => {
      const headers = new Headers();
      expect(headers.has("content-type")).toBe(false);
    });
  });

  describe("delete", () => {
    it("should delete existing header", () => {
      const headers = new Headers({ "Content-Type": "text/plain" });
      headers.delete("content-type");
      expect(headers.has("content-type")).toBe(false);
    });

    it("should not throw for non-existent header", () => {
      const headers = new Headers();
      expect(() => headers.delete("x-not-found")).not.toThrow();
    });
  });

  describe("iteration", () => {
    it("should iterate with entries()", () => {
      const headers = new Headers({
        "Content-Type": "text/plain",
        Accept: "application/json",
      });
      const entries = Array.from(headers.entries());
      expect(entries).toContainEqual(["content-type", "text/plain"]);
      expect(entries).toContainEqual(["accept", "application/json"]);
    });

    it("should iterate with keys()", () => {
      const headers = new Headers({
        "Content-Type": "text/plain",
        Accept: "application/json",
      });
      const keys = Array.from(headers.keys());
      expect(keys).toContain("content-type");
      expect(keys).toContain("accept");
    });

    it("should iterate with values()", () => {
      const headers = new Headers({
        "Content-Type": "text/plain",
        Accept: "application/json",
      });
      const values = Array.from(headers.values());
      expect(values).toContain("text/plain");
      expect(values).toContain("application/json");
    });

    it("should iterate with for...of", () => {
      const headers = new Headers({ "Content-Type": "text/plain" });
      const entries: [string, string][] = [];
      for (const entry of headers) {
        entries.push(entry);
      }
      expect(entries).toContainEqual(["content-type", "text/plain"]);
    });

    it("should iterate with forEach", () => {
      const headers = new Headers({ "Content-Type": "text/plain" });
      const entries: [string, string][] = [];
      headers.forEach((value, key) => {
        entries.push([key, value]);
      });
      expect(entries).toContainEqual(["content-type", "text/plain"]);
    });
  });

  describe("toArray", () => {
    it("should convert to array of tuples", () => {
      const headers = new Headers({
        "Content-Type": "text/plain",
        Accept: "application/json",
      });
      const arr = headers.toArray();
      expect(arr).toContainEqual(["content-type", "text/plain"]);
      expect(arr).toContainEqual(["accept", "application/json"]);
    });
  });

  describe("toJsHeaders", () => {
    it("should convert to JsHeader array", () => {
      const headers = new Headers({ "Content-Type": "text/plain" });
      const jsHeaders = headers.toJsHeaders();
      expect(jsHeaders).toContainEqual({ name: "content-type", value: "text/plain" });
    });
  });
});
