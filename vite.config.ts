import { defineConfig } from 'vite'
import type { ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

const documentHtmlPlugin = () => ({
  name: 'document-html-plugin',
  configureServer(server: ViteDevServer) {
    server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
      const docPath = path.resolve(process.cwd(), 'document.html')
      if (req.url === '/api/load' && req.method === 'GET') {
        if (fs.existsSync(docPath)) {
          const content = fs.readFileSync(docPath, 'utf-8')
          res.setHeader('Content-Type', 'text/html')
          res.end(content)
        } else {
          res.statusCode = 404
          res.end('Not found')
        }
        return
      }
      if (req.url === '/api/save' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          fs.writeFileSync(docPath, body)
          res.end('Saved')
        })
        return
      }
      next()
    })
  }
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), documentHtmlPlugin()],
  // For GitHub Pages: assets are served under /tablord/ in production
  base: process.env.NODE_ENV === 'production' ? '/tablord/' : '/',
})
