import { describe, it, expect, vi } from 'vitest';
import { FetchEvent, Request, Response } from '../../lib/fetch-event.js';
import type { JsResponse } from '../../index.js';

describe('FetchEvent', () => {
  function createMockEvent(
    url = 'https://example.com',
    method = 'GET',
    clientAddress = '127.0.0.1'
  ) {
    const request = new Request(url, { method });
    const respondCallback = vi.fn<[JsResponse], void>();
    const event = new FetchEvent(request, clientAddress, respondCallback);
    return { event, request, respondCallback };
  }

  describe('constructor', () => {
    it('should create a FetchEvent with request', () => {
      const { event, request } = createMockEvent();
      expect(event.request).toBe(request);
    });

    it('should store client address', () => {
      const { event } = createMockEvent('https://example.com', 'GET', '192.168.1.1');
      expect(event.clientAddress).toBe('192.168.1.1');
    });
  });

  describe('respondWith', () => {
    it('should call respond callback with Response', async () => {
      const { event, respondCallback } = createMockEvent();

      event.respondWith(new Response('Hello', { status: 200 }));

      // Wait for promise resolution
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(respondCallback).toHaveBeenCalledTimes(1);
      const jsResponse = respondCallback.mock.calls[0][0];
      expect(jsResponse.status).toBe(200);
    });

    it('should call respond callback with Promise<Response>', async () => {
      const { event, respondCallback } = createMockEvent();

      event.respondWith(Promise.resolve(new Response('Async', { status: 201 })));

      // Wait for promise resolution
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(respondCallback).toHaveBeenCalledTimes(1);
      const jsResponse = respondCallback.mock.calls[0][0];
      expect(jsResponse.status).toBe(201);
    });

    it('should throw if called twice', () => {
      const { event } = createMockEvent();

      event.respondWith(new Response('First'));

      expect(() => {
        event.respondWith(new Response('Second'));
      }).toThrow('respondWith() has already been called');
    });

    it('should handle promise rejection with 500 error', async () => {
      const { event, respondCallback } = createMockEvent();

      event.respondWith(Promise.reject(new Error('Something went wrong')));

      // Wait for promise rejection handling
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(respondCallback).toHaveBeenCalledTimes(1);
      const jsResponse = respondCallback.mock.calls[0][0];
      expect(jsResponse.status).toBe(500);
    });
  });

  describe('waitUntil', () => {
    it('should track waitUntil promises', () => {
      const { event } = createMockEvent();

      const promise1 = Promise.resolve();
      const promise2 = Promise.resolve();

      event.waitUntil(promise1);
      event.waitUntil(promise2);

      const promises = event._getWaitUntilPromises();
      expect(promises).toHaveLength(2);
      expect(promises).toContain(promise1);
      expect(promises).toContain(promise2);
    });

    it('should allow waitUntil after respondWith', () => {
      const { event } = createMockEvent();

      event.respondWith(new Response('OK'));
      expect(() => {
        event.waitUntil(Promise.resolve());
      }).not.toThrow();
    });
  });

  describe('_fromContext', () => {
    it('should create FetchEvent from RequestContext', () => {
      // Create a mock RequestContext
      const mockContext = {
        method: 'POST',
        url: 'https://example.com/api/data',
        headers: [
          { name: 'content-type', value: 'application/json' },
        ],
        body: Buffer.from('{"test":true}'),
        clientAddress: '10.0.0.1',
        respond: vi.fn(),
      };

      const event = FetchEvent._fromContext(mockContext as any);

      expect(event.request.method).toBe('POST');
      expect(event.request.url).toBe('https://example.com/api/data');
      expect(event.request.headers.get('content-type')).toBe('application/json');
      expect(event.clientAddress).toBe('10.0.0.1');
    });

    it('should call context.respond when respondWith is called', async () => {
      const mockContext = {
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        body: null,
        clientAddress: '127.0.0.1',
        respond: vi.fn(),
      };

      const event = FetchEvent._fromContext(mockContext as any);
      event.respondWith(new Response('OK'));

      // Wait for promise resolution
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockContext.respond).toHaveBeenCalledTimes(1);
    });
  });
});
