import { Hono } from "hono";
import { serve } from "bun";

const app = new Hono();

app.get("/", (c) => c.json({ ok: true, framework: "hono", runtime: "bun", host: "Pxxl" }));

serve({
  fetch: app.fetch,
  port: Number(process.env.PORT || 3000),
  hostname: "0.0.0.0"
});
