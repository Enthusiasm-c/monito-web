const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html>
      <head><title>Test Server</title></head>
      <body>
        <h1>Server is working!</h1>
        <p>Time: ${new Date().toLocaleString()}</p>
        <p>URL: ${req.url}</p>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Test server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down test server...');
  server.close(() => {
    console.log('✅ Test server stopped');
    process.exit(0);
  });
});