// Minimal test runner: starts the server, checks endpoints, then exits
const http = require("http");
const app = require("../src/index.js");

const PORT = 3099; // Use a non-default port to avoid conflicts

const server = app.listen(PORT, () => {
  let passed = 0;
  let failed = 0;

  function check(path, expected, callback) {
    http.get(`http://localhost:${PORT}${path}`, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          if (JSON.stringify(data[expected.key]) === JSON.stringify(expected.value)) {
            console.log(`PASS: GET ${path} -> ${expected.key} = ${JSON.stringify(expected.value)}`);
            passed++;
          } else {
            console.log(`FAIL: GET ${path} -> expected ${expected.key} = ${JSON.stringify(expected.value)}, got ${JSON.stringify(data[expected.key])}`);
            failed++;
          }
        } catch (e) {
          console.log(`FAIL: GET ${path} -> invalid JSON: ${body}`);
          failed++;
        }
        callback();
      });
    });
  }

  check("/health", { key: "status", value: "ok" }, () => {
    check("/api/info", { key: "name", value: "module-02-docker-lab" }, () => {
      check("/", { key: "message", value: "Module 02 Docker Lab API" }, () => {
        console.log(`\nResults: ${passed} passed, ${failed} failed`);
        server.close(() => {
          process.exit(failed > 0 ? 1 : 0);
        });
      });
    });
  });
});
