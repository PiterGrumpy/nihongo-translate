import type { ServerResponse } from 'node:http'
import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { InvalidRequestError, parseTranslationRequest, translate } from './server/translate.ts'

/** Corta cuerpos absurdos antes de gastar memoria. Una frase no llega ni a 1 KB. */
const MAX_BODY_BYTES = 10_000

/**
 * Monta `/api/translate` en el servidor de desarrollo y en `vite preview`.
 *
 * En local no hay Netlify, así que este plugin hace de Functions: la interfaz llama a
 * la misma URL que usará en producción y no sabe dónde está corriendo.
 */
function translateApi(): Plugin {
  const handle: Connect.NextHandleFunction = async (req, res) => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      sendJson(res, 405, { error: 'Método no permitido. Usa POST.' })
      return
    }

    try {
      const body = JSON.parse(await readBody(req)) as unknown
      const request = parseTranslationRequest(body)
      sendJson(res, 200, translate(request))
    } catch (error) {
      if (error instanceof InvalidRequestError) return sendJson(res, 400, { error: error.message })
      if (error instanceof SyntaxError) {
        return sendJson(res, 400, { error: 'El cuerpo no es JSON válido.' })
      }
      console.error('[api/translate]', error)
      sendJson(res, 500, { error: 'Error interno del servidor.' })
    }
  }

  return {
    name: 'nihon-translator-api',
    configureServer(server) {
      server.middlewares.use('/api/translate', handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/translate', handle)
    },
  }
}

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    let size = 0

    req.on('data', (chunk: { length: number; toString(): string }) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new InvalidRequestError('La petición es demasiado grande.'))
        return
      }
      body += chunk.toString()
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

// El servidor de desarrollo: Vite sirve la app en http://localhost:5173
export default defineConfig({
  plugins: [react(), tailwindcss(), translateApi()],
})
