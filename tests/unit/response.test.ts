import { describe, it, expect } from 'vitest';
import { Response, Headers } from '../../lib/fetch-event.js';

describe('Response', () => {
  describe('constructor', () => {
    it('should create a default 200 OK response', () => {
      const response = new Response();
      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(response.ok).toBe(true);
    });

    it('should create a response with string body', () => {
      const response = new Response('Hello, World!');
      expect(response.status).toBe(200);
      expect(response.bodyUsed).toBe(false);
    });

    it('should create a response with null body', () => {
      const response = new Response(null);
      expect(response.body).toBeNull();
    });

    it('should create a response with custom status', () => {
      const response = new Response('Not Found', { status: 404 });
      expect(response.status).toBe(404);
      expect(response.ok).toBe(false);
    });

    it('should create a response with custom statusText', () => {
      const response = new Response(null, {
        status: 201,
        statusText: 'Created',
      });
      expect(response.status).toBe(201);
      expect(response.statusText).toBe('Created');
    });

    it('should create a response with headers object', () => {
      const response = new Response('test', {
        headers: { 'Content-Type': 'text/plain' },
      });
      expect(response.headers.get('content-type')).toBe('text/plain');
    });

    it('should create a response with Headers instance', () => {
      const headers = new Headers({ 'X-Custom': 'value' });
      const response = new Response('test', { headers });
      expect(response.headers.get('x-custom')).toBe('value');
    });

    it('should create a response with Buffer body', () => {
      const buffer = Buffer.from('hello');
      const response = new Response(buffer);
      expect(response.bodyUsed).toBe(false);
    });

    it('should create a response with ArrayBuffer body', () => {
      const buffer = new ArrayBuffer(4);
      const response = new Response(buffer);
      expect(response.bodyUsed).toBe(false);
    });

    it('should create a response with Uint8Array body', () => {
      const array = new Uint8Array([1, 2, 3, 4]);
      const response = new Response(array);
      expect(response.bodyUsed).toBe(false);
    });
  });

  describe('ok property', () => {
    it('should return true for 2xx status', () => {
      expect(new Response(null, { status: 200 }).ok).toBe(true);
      expect(new Response(null, { status: 201 }).ok).toBe(true);
      expect(new Response(null, { status: 299 }).ok).toBe(true);
    });

    it('should return false for non-2xx status', () => {
      expect(new Response(null, { status: 100 }).ok).toBe(false);
      expect(new Response(null, { status: 199 }).ok).toBe(false);
      expect(new Response(null, { status: 300 }).ok).toBe(false);
      expect(new Response(null, { status: 404 }).ok).toBe(false);
      expect(new Response(null, { status: 500 }).ok).toBe(false);
    });
  });

  describe('body methods', () => {
    it('should return empty string for text() with no body', async () => {
      const response = new Response();
      const text = await response.text();
      expect(text).toBe('');
    });

    it('should parse text body', async () => {
      const response = new Response('hello world');
      const text = await response.text();
      expect(text).toBe('hello world');
    });

    it('should parse JSON body', async () => {
      const response = new Response('{"name":"John"}');
      const json = await response.json<{ name: string }>();
      expect(json).toEqual({ name: 'John' });
    });

    it('should return ArrayBuffer', async () => {
      const response = new Response('test');
      const buffer = await response.arrayBuffer();
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBe(4);
    });

    it('should return Blob', async () => {
      const response = new Response('test');
      const blob = await response.blob();
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBe(4);
    });

    it('should throw when body already consumed', async () => {
      const response = new Response('test');
      await response.text();
      expect(response.bodyUsed).toBe(true);
      await expect(response.text()).rejects.toThrow('Body has already been consumed');
    });

    it('should throw for formData() (not implemented)', async () => {
      const response = new Response('test');
      await expect(response.formData()).rejects.toThrow('FormData parsing not yet implemented');
    });
  });

  describe('body property', () => {
    it('should return null when no body', () => {
      const response = new Response();
      expect(response.body).toBeNull();
    });

    it('should return ReadableStream when body exists', () => {
      const response = new Response('test');
      expect(response.body).toBeInstanceOf(ReadableStream);
    });
  });

  describe('static json()', () => {
    it('should create a JSON response', async () => {
      const response = Response.json({ message: 'Hello' });
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');
      const json = await response.json();
      expect(json).toEqual({ message: 'Hello' });
    });

    it('should create a JSON response with custom status', async () => {
      const response = Response.json({ error: 'Not Found' }, { status: 404 });
      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toBe('application/json');
    });

    it('should serialize complex objects', async () => {
      const data = {
        users: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
        total: 2,
      };
      const response = Response.json(data);
      const json = await response.json();
      expect(json).toEqual(data);
    });
  });

  describe('static redirect()', () => {
    it('should create a 302 redirect by default', () => {
      const response = Response.redirect('https://example.com');
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('https://example.com');
    });

    it('should create a redirect with custom status', () => {
      const response = Response.redirect('https://example.com', 301);
      expect(response.status).toBe(301);
    });

    it('should accept valid redirect statuses', () => {
      expect(Response.redirect('/', 301).status).toBe(301);
      expect(Response.redirect('/', 302).status).toBe(302);
      expect(Response.redirect('/', 303).status).toBe(303);
      expect(Response.redirect('/', 307).status).toBe(307);
      expect(Response.redirect('/', 308).status).toBe(308);
    });

    it('should throw for invalid redirect status', () => {
      expect(() => Response.redirect('/', 200)).toThrow('Invalid redirect status: 200');
      expect(() => Response.redirect('/', 404)).toThrow('Invalid redirect status: 404');
    });
  });

  describe('static error()', () => {
    it('should create an error response with status 0', () => {
      const response = Response.error();
      expect(response.status).toBe(0);
    });
  });

  describe('clone', () => {
    it('should clone a response', async () => {
      const response = new Response('test body', {
        status: 201,
        headers: { 'X-Test': 'value' },
      });
      const cloned = response.clone();
      expect(cloned.status).toBe(201);
      expect(cloned.headers.get('x-test')).toBe('value');
      expect(await cloned.text()).toBe('test body');
    });

    it('should throw when cloning consumed response', async () => {
      const response = new Response('test');
      await response.text();
      expect(() => response.clone()).toThrow('Cannot clone a Response whose body has been used');
    });
  });

  describe('_toJsResponse', () => {
    it('should convert to JsResponse format', () => {
      const response = new Response('test', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
      const jsResponse = response._toJsResponse();
      expect(jsResponse.status).toBe(200);
      expect(jsResponse.headers).toContainEqual({ name: 'content-type', value: 'text/plain' });
      expect(jsResponse.body).toBeDefined();
    });

    it('should handle null body', () => {
      const response = new Response(null, { status: 204 });
      const jsResponse = response._toJsResponse();
      expect(jsResponse.status).toBe(204);
      expect(jsResponse.body).toBeUndefined();
    });
  });
});
