import express from "express";

const app = express();
const port = Number(process.env.PORT || 3000);

app.get("/", (_req, res) => {
  res.json({
    service: "api",
    status: "ok",
    message: "API service running on Pxxl",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "healthy" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`API service listening on ${port}`);
});
