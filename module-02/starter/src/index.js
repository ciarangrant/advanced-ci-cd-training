const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/info", (_req, res) => {
  res.json({
    name: "module-02-docker-lab",
    version: "1.0.0",
    node: process.version,
    uptime: process.uptime(),
  });
});

app.get("/", (_req, res) => {
  res.json({ message: "Module 02 Docker Lab API!!!" });
});

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Graceful shutdown on SIGTERM (sent by Docker/Kubernetes)
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    process.exit(0);
  });
});

module.exports = app;
