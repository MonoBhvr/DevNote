import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

import { buildClientApp } from './build/buildClientApp.mjs'

const port = Number(process.env.PORT || 4173)
const rootDir = process.cwd()
const distDir = join(rootDir, 'dist')

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
}

function safePath (urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '')
  return normalize(clean).replace(/^(\.\.[/\\])+/, '')
}

async function resolveFile (urlPath) {
  const clean = safePath(urlPath)
  const candidate = join(distDir, clean || 'index.html')
  const info = await stat(candidate).catch(() => null)
  if (info?.isFile()) return candidate
  const index = join(candidate, 'index.html')
  const indexInfo = await stat(index).catch(() => null)
  return indexInfo?.isFile() ? index : null
}

await buildClientApp({ rootDir, outDir: distDir })

const server = createServer(async (request, response) => {
  const file = await resolveFile(request.url || '/')
  if (!file) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }
  response.writeHead(200, { 'content-type': contentTypes[extname(file)] || 'application/octet-stream' })
  createReadStream(file).pipe(response)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`DevNote preview: http://127.0.0.1:${port}/`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
