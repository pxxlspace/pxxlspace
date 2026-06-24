import express from "express";

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (_req, res) => {
  res.json({
    name: "Pxxl Express API",
    message: "Deploy Node APIs on Pxxl with custom domains, SSL, logs, and global routing.",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Pxxl Express API listening on ${port}`);
});
