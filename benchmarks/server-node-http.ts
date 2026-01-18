/**
 * Native Node.js HTTP server for benchmarking comparison
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";

const PORT = parseInt(process.env.PORT || "3001", 10);

const TEXT_RESPONSE = "Hello, World!";

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  switch (url.pathname) {
    case "/json":
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Hello, World!" }));
      break;

    case "/text":
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(TEXT_RESPONSE);
      break;

    case "/echo":
      // Echo back the request body
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const body = Buffer.concat(chunks);
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(body);
      });
      break;

    default:
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Hello, World!" }));
  }
});

server.listen(PORT, () => {
  console.log(`Node.js HTTP server listening on http://localhost:${PORT}`);
});
