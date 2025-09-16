const http = require('http')
const port = process.env.PORT || 5180
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end('<!doctype html><html><body><h1>Test Server OK</h1></body></html>')
})
server.listen(port, '127.0.0.1', () => {
  console.log('test-server listening on http://127.0.0.1:' + port)
})
