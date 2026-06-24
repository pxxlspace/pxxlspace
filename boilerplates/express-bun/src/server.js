import express from "express";

const app = express();
const port = Number(process.env.PORT || 3000);

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    framework: "express",
    runtime: "bun",
    message: "Deployed on Pxxl"
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Express + Bun listening on ${port}`);
});
