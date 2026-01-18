/**
 * Hello World Example
 *
 * A simple server that responds with "Hello, World!" to all requests.
 *
 * Run with: npx tsx examples/hello-world.ts
 */

import { Server, Response } from '../lib/index.js';

async function main() {
  const server = new Server({ port: 3000 });

  server.addEventListener('fetch', (event) => {
    event.respondWith(
      new Response('Hello, World!', {
        headers: { 'Content-Type': 'text/plain' },
      })
    );
  });

  await server.listen();
  console.log('Server listening on http://localhost:3000');
}

main().catch(console.error);
