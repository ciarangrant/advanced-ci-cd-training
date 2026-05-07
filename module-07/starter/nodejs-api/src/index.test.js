const { describe, it } = require("node:test");
const assert = require("node:assert");
const http = require("http");
const app = require("./index");

let server;

describe("API", () => {
  it("GET /health returns 200 with status ok", (t, done) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      http.get(`http://localhost:${port}/health`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          assert.strictEqual(res.statusCode, 200);
          const body = JSON.parse(data);
          assert.strictEqual(body.status, "ok");
          assert.ok(typeof body.uptime === "number");
          server.close(done);
        });
      });
    });
  });

  it("GET /api/items returns an array", (t, done) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      http.get(`http://localhost:${port}/api/items`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          assert.strictEqual(res.statusCode, 200);
          const body = JSON.parse(data);
          assert.ok(Array.isArray(body));
          assert.ok(body.length > 0);
          server.close(done);
        });
      });
    });
  });
});
