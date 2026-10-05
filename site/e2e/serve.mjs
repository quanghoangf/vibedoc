// Serves the built site (dist/) under /vibedoc, like GitHub Pages does, for the Playwright run.
// (`astro preview` starts in the background when it has no terminal, so Playwright can't own it.)
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../dist')
const port = Number(process.env.PORT ?? 4321)
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webm': 'video/webm', '.mp4': 'video/mp4', '.xml': 'application/xml', '.txt': 'text/plain' }

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  if (!url.pathname.startsWith('/vibedoc')) { res.writeHead(404).end(); return }
  let file = path.join(root, decodeURIComponent(url.pathname.slice('/vibedoc'.length)))
  if (!file.startsWith(root)) { res.writeHead(403).end(); return }
  try { if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html') } catch {}
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }).end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(port, () => console.log(`serving dist/ at http://localhost:${port}/vibedoc/`))
