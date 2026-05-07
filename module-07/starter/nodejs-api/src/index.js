const express = require("express");
// feedback round 2026-04-17 / FB-005-ENV — Prometheus instrumentation
const client = require("prom-client");

const app = express();
const PORT = process.env.PORT || 3000;
const startTime = Date.now();

app.use(express.json());

// feedback round 2026-04-17 / FB-005-ENV — metrics registry + HTTP counter
const register = new client.Registry();
register.setDefaultLabels({ service: "nodejs-api" });
client.collectDefaultMetrics({ register });
const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests by method, route, and status code",
  labelNames: ["method", "route", "status"],
  registers: [register],
});
app.use((req, res, next) => {
  res.on("finish", () => {
    httpRequestsTotal.inc({
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status: String(res.statusCode),
    });
  });
  next();
});

// Health endpoint — used by Docker HEALTHCHECK and ALB target group health checks
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

// Sample API endpoints
app.get("/api/items", (req, res) => {
  res.json([
    { id: 1, name: "Pipeline Config", type: "yaml" },
    { id: 2, name: "Dockerfile", type: "docker" },
    { id: 3, name: "Terraform Plan", type: "hcl" },
  ]);
});

app.get("/api/items/:id", (req, res) => {
  const items = [
    { id: 1, name: "Pipeline Config", type: "yaml" },
    { id: 2, name: "Dockerfile", type: "docker" },
    { id: 3, name: "Terraform Plan", type: "hcl" },
  ];
  const item = items.find((i) => i.id === parseInt(req.params.id));
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }
  res.json(item);
});

// feedback round 2026-04-17 / FB-005-ENV — Prometheus scrape endpoint
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

module.exports = app;

// Only start the server when run directly (not when required by tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API server listening on port ${PORT}`);
  });
}
