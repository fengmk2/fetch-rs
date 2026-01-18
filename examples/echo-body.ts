/**
 * Echo Body Example
 *
 * A server that echoes back request bodies in various formats.
 *
 * Run with: npx tsx examples/echo-body.ts
 */

import { Server, Response, Headers } from '../lib/index';

const server = new Server({
  port: 3000,
  maxBodySize: 10 * 1024 * 1024, // 10MB limit
});

server.addEventListener('fetch', async (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Echo as text
  if (url.pathname === '/echo/text' && request.method === 'POST') {
    const body = await request.text();
    event.respondWith(
      new Response(body, {
        headers: {
          'Content-Type': 'text/plain',
          'X-Echo-Length': String(body.length),
        },
      })
    );
    return;
  }

  // Echo as JSON (parse and re-stringify)
  if (url.pathname === '/echo/json' && request.method === 'POST') {
    try {
      const json = await request.json();
      event.respondWith(
        Response.json({
          echoed: json,
          timestamp: Date.now(),
        })
      );
    } catch {
      event.respondWith(
        Response.json({ error: 'Invalid JSON' }, { status: 400 })
      );
    }
    return;
  }

  // Echo with headers inspection
  if (url.pathname === '/echo/inspect' && request.method === 'POST') {
    const body = await request.text();
    const headers: Record<string, string> = {};

    for (const [key, value] of request.headers) {
      headers[key] = value;
    }

    event.respondWith(
      Response.json({
        method: request.method,
        url: request.url,
        headers,
        bodyLength: body.length,
        bodyPreview: body.slice(0, 100) + (body.length > 100 ? '...' : ''),
      })
    );
    return;
  }

  // Simple echo (any path, any method with body)
  if (request.method === 'POST' || request.method === 'PUT') {
    const body = await request.text();
    const contentType = request.headers.get('content-type') || 'text/plain';

    event.respondWith(
      new Response(body, {
        headers: { 'Content-Type': contentType },
      })
    );
    return;
  }

  // Instructions
  event.respondWith(
    new Response(
      `Echo Server

Endpoints:
  POST /echo/text    - Echo body as text
  POST /echo/json    - Echo body as JSON with metadata
  POST /echo/inspect - Return request inspection (method, headers, body preview)
  POST /any/path     - Simple echo with original content-type

Examples:
  curl -X POST -d "Hello" http://localhost:3000/echo/text
  curl -X POST -H "Content-Type: application/json" -d '{"foo":"bar"}' http://localhost:3000/echo/json
`,
      { headers: { 'Content-Type': 'text/plain' } }
    )
  );
});

await server.listen();
console.log('Echo server listening on http://localhost:3000');
