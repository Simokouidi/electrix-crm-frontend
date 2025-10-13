const http = require('http')
const fs = require('fs')
const path = require('path')

const dist = path.join(process.cwd(), 'dist')

const server = http.createServer((req, res) => {
  let file = req.url === '/' ? '/index.html' : req.url
  const p = path.join(dist, file)
  fs.readFile(p, (err, data) => {
    if (err) {
      const index = path.join(dist, 'index.html')
      fs.createReadStream(index).pipe(res)
      return
    }
    const ext = path.extname(p)
    const map = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.json': 'application/json'
    }
    res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' })
    res.end(data)
  })
})

const port = process.env.PORT || 5173
server.listen(port, () => console.log(`static server running on ${port}`))
