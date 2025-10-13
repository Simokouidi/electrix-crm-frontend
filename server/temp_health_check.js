const http = require('http');
const PORT = 4000;
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});
server.on('listening', () => console.log('temp_health_check listening on', PORT));
server.on('error', (err) => { console.error('temp_health_check error', err && err.code, err && err.message); process.exit(1); });
server.listen(PORT);
