const http = require('node:http');

const PORT = process.env.PORT || 3000;

function handleRequest(req, res) {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('CI/CD Lab 01 — Pipeline Architecture');
}

module.exports = { handleRequest };

// Only start the server when run directly (not when required by tests)
if (require.main === module) {
  const server = http.createServer(handleRequest);
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
