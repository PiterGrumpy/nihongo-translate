import type { ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { InvalidRequestError, parseTranslationRequest, translate } from './server/translate.ts'
import { ProviderError, type ProviderEnv } from './server/providers/index.ts'

/** Corta cuerpos absurdos antes de gastar memoria. Una frase no llega ni a 1 KB. */
const MAX_BODY_BYTES = 10_000

/**
 * Monta `/api/translate` en el servidor de desarrollo y en `vite preview`.
 *
 * En local no hay Netlify, así que este plugin hace de Functions: la interfaz llama a
 * la misma URL que usará en producción y no sabe dónde está corriendo.
 *
 * Las credenciales llegan ya resueltas desde `defineConfig` (abajo): aquí no se lee
 * ningún archivo, y la clave nunca entra en el bundle del navegador.
 */
function translateApi(env: ProviderEnv): Plugin {
  const handle: Connect.NextHandleFunction = async (req, res) => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      sendJson(res, 405, { error: 'Método no permitido. Usa POST.' })
      return
    }

    try {
      const body = JSON.parse(await readBody(req)) as unknown
      const request = parseTranslationRequest(body)
      sendJson(res, 200, await translate(request, env))
    } catch (error) {
      if (error instanceof InvalidRequestError) return sendJson(res, 400, { error: error.message })
      if (error instanceof SyntaxError) {
        return sendJson(res, 400, { error: 'El cuerpo no es JSON válido.' })
      }
      // 429 (cupo), 503 (saturado), 504 (timeout) y 502 (respuesta rara) vienen ya
      // con su código y su mensaje desde el proveedor.
      if (error instanceof ProviderError) return sendJson(res, error.status, { error: error.message })
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

/**
 * Vite no mete el `.env` en `process.env` para el código del servidor de desarrollo:
 * hay que leerlo con `loadEnv`. El tercer argumento vacío significa "todas las
 * variables", no solo las que empiezan por `VITE_` (que serían las públicas).
 */
function providerEnv(mode: string): ProviderEnv {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    provider: env.AI_PROVIDER || 'gemini',
    apiKey: env.GEMINI_API_KEY ?? '',
    // Valores medidos el 2026-10-31: 3.5-flash-lite responde en 4-6 s; 3.8-flash tardaba 40 s.
    model: env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    // Vacío desactiva la reserva; si no, es el modelo que se prueba tras un fallo del principal.
    fallbackModel: env.GEMINI_FALLBACK_MODEL ?? 'gemini-3.5-flash',
    timeoutMs: Number(env.GEMINI_TIMEOUT_MS) || 15_000,
    // Sin valor = no se envía thinkingConfig (menos llamadas y menos cupo).
    thinkingBudget: thinkingBudgetOf(env.GEMINI_THINKING_BUDGET),
    // Si el principal no contesta en este tiempo, sale la reserva en paralelo.
    hedgeDelayMs: Number(env.GEMINI_HEDGE_DELAY_MS) || 1500,
  }
}

/** `GEMINI_THINKING_BUDGET` vacío o inválido se traduce a "no enviar el campo". */
function thinkingBudgetOf(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null
  const budget = Number(value)
  return Number.isFinite(budget) ? budget : null
}

// El servidor de desarrollo: Vite sirve la app en http://localhost:5173
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), translateApi(providerEnv(mode))],
}))
