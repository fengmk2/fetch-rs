/**
 * JSON API Example
 *
 * A server that handles JSON API requests with routing.
 *
 * Run with: npx tsx examples/json-api.ts
 */

import { Server, Response } from '../lib/index.js';

async function main() {
const server = new Server({ port: 3000 });

// In-memory data store
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com' },
];

server.addEventListener('fetch', async (event) => {
  const url = new URL(event.request.url);
  const { pathname } = url;
  const method = event.request.method;

  // Health check endpoint
  if (pathname === '/api/health') {
    event.respondWith(
      Response.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      })
    );
    return;
  }

  // List all users
  if (pathname === '/api/users' && method === 'GET') {
    event.respondWith(Response.json({ users }));
    return;
  }

  // Get single user
  const userMatch = pathname.match(/^\/api\/users\/(\d+)$/);
  if (userMatch && method === 'GET') {
    const userId = parseInt(userMatch[1], 10);
    const user = users.find((u) => u.id === userId);

    if (user) {
      event.respondWith(Response.json({ user }));
    } else {
      event.respondWith(
        Response.json({ error: 'User not found' }, { status: 404 })
      );
    }
    return;
  }

  // Create user
  if (pathname === '/api/users' && method === 'POST') {
    try {
      const body = await event.request.json<{ name: string; email: string }>();
      const newUser = {
        id: users.length + 1,
        name: body.name,
        email: body.email,
      };
      users.push(newUser);

      event.respondWith(Response.json({ user: newUser }, { status: 201 }));
    } catch {
      event.respondWith(
        Response.json({ error: 'Invalid JSON body' }, { status: 400 })
      );
    }
    return;
  }

  // 404 for all other routes
  event.respondWith(
    Response.json({ error: 'Not Found', path: pathname }, { status: 404 })
  );
});

await server.listen();
console.log('JSON API server listening on http://localhost:3000');
console.log('Try:');
console.log('  curl http://localhost:3000/api/health');
console.log('  curl http://localhost:3000/api/users');
console.log('  curl http://localhost:3000/api/users/1');
console.log('  curl -X POST -H "Content-Type: application/json" -d \'{"name":"Dave","email":"dave@example.com"}\' http://localhost:3000/api/users');
}

main().catch(console.error);
