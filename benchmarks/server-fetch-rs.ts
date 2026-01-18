/**
 * fetch-rs server for benchmarking
 */

import { Server, Response } from "../lib/index.js";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main() {
  const server = new Server({ port: PORT });

  server.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    switch (url.pathname) {
      case "/json":
        event.respondWith(Response.json({ message: "Hello, World!" }));
        break;

      case "/text":
        event.respondWith(
          new Response("Hello, World!", {
            headers: { "Content-Type": "text/plain" },
          }),
        );
        break;

      case "/echo":
        // Echo back the request body
        void event.request.text().then((body) => {
          event.respondWith(new Response(body));
        });
        break;

      default:
        event.respondWith(Response.json({ message: "Hello, World!" }));
    }
  });

  await server.listen();
  console.log(`fetch-rs server listening on http://localhost:${PORT}`);
}

main().catch(console.error);
