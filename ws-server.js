const { setupWSConnection } = require('y-websocket/bin/utils')
const http = require('http')
const WebSocket = require('ws')

const server = http.createServer((_, res) => {
  res.writeHead(200)
  res.end('Yjs WS')
})
const wss = new WebSocket.Server({ server })
wss.on('connection', setupWSConnection)
const PORT = process.env.WS_PORT || 1234
server.listen(PORT, () => console.log(`[vibedoc-ws] Yjs server on ws://localhost:${PORT}`))
