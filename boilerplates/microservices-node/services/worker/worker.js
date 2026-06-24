const intervalMs = Number(process.env.WORKER_INTERVAL_MS || 15000);

console.log("Worker service started on Pxxl");

setInterval(() => {
  console.log(JSON.stringify({
    service: "worker",
    status: "running",
    timestamp: new Date().toISOString(),
  }));
}, intervalMs);
