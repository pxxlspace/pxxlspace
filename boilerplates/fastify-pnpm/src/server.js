import Fastify from "fastify";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT || 3000);

app.get("/", async () => ({
  ok: true,
  framework: "fastify",
  packageManager: "pnpm",
  deployedOn: "Pxxl"
}));

await app.listen({ port, host: "0.0.0.0" });
