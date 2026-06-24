import { createServer } from "node:http";

const port = Number(process.env.PORT || 3000);

createServer((request, response) => {
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ ok: true, path: request.url, service: "Pxxl TypeScript API" }));
}).listen(port, "0.0.0.0", () => {
  console.log(`Pxxl TypeScript API listening on ${port}`);
});
