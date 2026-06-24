import { createServer } from "node:http";

const port = Number(process.env.PORT || 3000);

createServer((_request, response) => {
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ ok: true, service: "Dockerfile Node on Pxxl" }));
}).listen(port, "0.0.0.0");
