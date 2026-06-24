import express from "express";

const app = express();
const port = Number(process.env.PORT || 3000);

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "Express on Pxxl with Yarn" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Express API listening on ${port}`);
});
