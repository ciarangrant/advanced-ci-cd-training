const http = require('node:http');
// TODO: Import the flags module from ./flags.js

const PORT = process.env.PORT || 3000;

function handleRequest(req, res) {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.url === '/dashboard') {
    const response = { user: 'demo-user', timestamp: Date.now() };

    // TODO: Check if the 'new-dashboard-widget' flag is enabled.
    // If enabled, add a widget field to the response:
    //   response.widget = { type: 'analytics', title: 'New Dashboard Widget' };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Deployment Lab 04 — Advanced Deployment Strategies');
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = { handleRequest };
