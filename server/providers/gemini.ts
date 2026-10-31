import type { Prompt } from '../prompts.ts'

/**
 * El proveedor de Gemini: la única parte del proyecto que habla con Google.
 *
 * No sabe nada de HTTP, de Vite ni de React. Recibe un prompt y unas credenciales,
 * devuelve el JSON crudo de la IA (sin validar: de eso se encarga `translate.ts`).
 *
 * La clave llega como parámetro y no se lee aquí de `process.env` a propósito:
 * en desarrollo la carga `vite.config.ts` con `loadEnv`, en Netlify llegará de
 * `process.env`. El mismo código sirve para los dos sitios.
 */

/** Credenciales y ajustes del proveedor, ya resueltos por quien llama. */
export type ProviderEnv = {
  provider: string
  apiKey: string
  model: string
  /** Modelo al que se recurre si el principal falla por saturación, cupo o timeout. Vacío = sin reserva. */
  fallbackModel: string
  timeoutMs: number
  /** Tokens de "pensamiento" permitidos. `null` = no enviar el campo (el modelo decide). */
  thinkingBudget: number | null
  /** Cuánto se espera al principal antes de lanzar la reserva en paralelo. */
  hedgeDelayMs: number
}

/** Error con un código HTTP asociado, para que la capa HTTP no tenga que adivinar. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * Modelos que ya han rechazado el `thinkingConfig`.
 *
 * Solo se usa si tú pides un presupuesto con `GEMINI_THINKING_BUDGET`: algunos modelos
 * no aceptan ese campo y devuelven 400. Se recuerda por modelo para no repetir el 400.
 */
const thinkingRejected = new Set<string>()

/**
 * Hace la llamada y devuelve el JSON ya parseado, sin comprobar su forma.
 * Lanza `ProviderError` con un mensaje en español listo para enseñar al usuario.
 *
 * Estrategia contra la cola del free tier (ver `raceModels`):
 * - se pide al modelo principal;
 * - si no contesta en `hedgeDelayMs`, se lanza el de reserva **en paralelo**;
 * - gana el primero que conteste bien y se cancela el otro.
 *
 * Un fallo de configuración (clave ausente, modelo inventado, respuesta ilegible) no se
 * reintenta: se avisa, porque el modelo de reserva taparía el error.
 */
export async function askGemini(prompt: Prompt, env: ProviderEnv): Promise<unknown> {
  if (!env.apiKey) {
    throw new ProviderError(
      'Falta GEMINI_API_KEY en el servidor. Copia .env.example a .env y pega tu clave.',
      500,
    )
  }

  const models = modelsToTry(env)
  if (models.length === 1) return askModel(prompt, env, models[0])

  return raceModels(prompt, env, models[0], models[1])
}

/** Con reserva vacía o repetida, solo se prueba el principal. */
function modelsToTry(env: ProviderEnv): string[] {
  if (env.fallbackModel === '' || env.fallbackModel === env.model) return [env.model]

  return [env.model, env.fallbackModel]
}

/**
 * Carrera entre dos modelos.
 *
 * El de reserva no sale a la vez que el principal, sino tras un retardo corto: si el
 * principal contesta rápido (lo normal), no se gasta ni una petición de más. Si tarda,
 * los dos compiten y gana el primero que termine; el otro se cancela.
 *
 * Si el principal falla antes del retardo (por ejemplo un 503 inmediato), la reserva
 * arranca en ese momento sin esperar.
 */
function raceModels(prompt: Prompt, env: ProviderEnv, primary: string, fallback: string): Promise<unknown> {
  const controllers = new Map<string, AbortController>()
  let remaining = 2
  let settled = false
  let fallbackStarted = false
  let timer: ReturnType<typeof setTimeout> | undefined

  return new Promise((resolve, reject) => {
    const finish = (action: () => void) => {
      settled = true
      if (timer) clearTimeout(timer)
      action()
    }

    const start = (model: string) => {
      const controller = new AbortController()
      controllers.set(model, controller)

      askModel(prompt, env, model, controller.signal)
        .then((answer) => {
          if (settled) return
          finish(() => {
            for (const [other, otherController] of controllers) {
              if (other !== model) otherController.abort()
            }
            if (model === fallback) {
              console.warn(`[gemini] ganó la reserva: ${fallback}`)
            }
            resolve(answer)
          })
        })
        .catch((error: unknown) => {
          remaining--
          if (settled) return

          // Fallo recuperable y la reserva aún no ha salido: sale ahora, sin esperar al reloj.
          if (isRetryable(error) && !fallbackStarted) {
            startFallback()
            return
          }

          console.warn(`[gemini] ${model} no respondió: ${messageOf(error)}`)

          if (!isRetryable(error) || remaining === 0) {
            finish(() => {
              for (const otherController of controllers.values()) otherController.abort()
              reject(error)
            })
          }
        })
    }

    const startFallback = () => {
      if (fallbackStarted || settled) return
      fallbackStarted = true
      if (timer) clearTimeout(timer)
      console.warn(`[gemini] ${primary} tarda; arranca la carrera con ${fallback}`)
      start(fallback)
    }

    start(primary)
    timer = setTimeout(startFallback, env.hedgeDelayMs)
  })
}

/** Mensaje de un error desconocido, para el log. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** ¿Merece la pena repetir la petición con otro modelo? */
function isRetryable(error: unknown): error is ProviderError {
  if (!(error instanceof ProviderError)) return false

  // 503 saturado · 504 timeout · 429 cupo agotado (los límites son por modelo).
  return error.status === 503 || error.status === 504 || error.status === 429
}

/** Un intento completo contra un modelo concreto. */
async function askModel(
  prompt: Prompt,
  env: ProviderEnv,
  model: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const wantsThinking = env.thinkingBudget !== null && !thinkingRejected.has(model)
  let response = await send(prompt, env, model, wantsThinking ? env.thinkingBudget : null, signal)

  // Solo si pediste `GEMINI_THINKING_BUDGET` y el modelo no lo acepta: un reintento.
  if (response.status === 400 && wantsThinking) {
    thinkingRejected.add(model)
    console.warn(`[gemini] ${model} no acepta thinkingConfig; se reintenta sin él`)
    response = await send(prompt, env, model, null, signal)
  }

  if (!response.ok) throw await toProviderError(response, model)

  return readJson(await readPayload(response))
}

/** Cuerpo de la petición a Gemini. `thinkingBudget` en `null` = no enviar el campo. */
function requestBody(prompt: Prompt, thinkingBudget: number | null) {
  const generationConfig: Record<string, unknown> = {
    responseMimeType: 'application/json',
    responseSchema: prompt.schema,
    temperature: 0.2,
    // Margen para el desglose de una frase de hasta 500 caracteres.
    maxOutputTokens: 2048,
  }

  if (thinkingBudget !== null) generationConfig.thinkingConfig = { thinkingBudget }

  return {
    systemInstruction: { parts: [{ text: prompt.systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: prompt.userText }] }],
    generationConfig,
  }
}

/** Una llamada HTTP suelta a un modelo concreto, con timeout y cancelación opcional. */
async function send(
  prompt: Prompt,
  env: ProviderEnv,
  model: string,
  thinkingBudget: number | null,
  signal?: AbortSignal,
): Promise<Response> {
  const timeout = AbortSignal.timeout(env.timeoutMs)

  try {
    return await fetch(`${ENDPOINT}/${model}:generateContent?key=${env.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody(prompt, thinkingBudget)),
      // Se cancela por timeout o porque la carrera ya la ha ganado el otro modelo.
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
  } catch (error) {
    // Cancelada a propósito (el otro modelo ganó): no es un error para el usuario.
    if (signal?.aborted) throw new ProviderError('Petición cancelada.', 499)

    // La clave va en la URL: nunca se mete el error de red tal cual en el mensaje.
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new ProviderError(
        `La IA tardó más de ${Math.round(env.timeoutMs / 1000)} s en contestar. Vuelve a intentarlo.`,
        504,
      )
    }
    throw new ProviderError('No se pudo contactar con la IA. Revisa tu conexión a internet.', 502)
  }
}

/** Traduce los códigos de Google a mensajes útiles y a nuestros códigos HTTP. */
async function toProviderError(response: Response, model: string): Promise<ProviderError> {
  const detail = await readErrorDetail(response)
  console.error(`[gemini] ${response.status} (${model}): ${detail}`)

  if (response.status === 429) {
    return new ProviderError(
      'Se agotó el cupo gratuito de Gemini. Espera un minuto y vuelve a intentarlo.',
      429,
    )
  }
  if (response.status === 503) {
    return new ProviderError(
      'El modelo está saturado ahora mismo. Reintenta en unos segundos o cambia GEMINI_MODEL en .env.',
      503,
    )
  }
  if (response.status === 400 || response.status === 404) {
    // El detalle en inglés de Google se queda en el log: al usuario no le sirve.
    return new ProviderError('La IA rechazó la petición. Revisa que GEMINI_MODEL exista en .env.', 502)
  }
  return new ProviderError(`La IA falló (${response.status}). Inténtalo de nuevo.`, 502)
}

/** Saca el mensaje del cuerpo de error de Google, sin reventar si no es JSON. */
async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } }
    const message = body.error?.message
    return typeof message === 'string' ? message : 'sin detalle'
  } catch {
    return 'sin detalle'
  }
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
}

/** Junta el texto de todas las partes de la respuesta. */
async function readPayload(response: Response): Promise<string> {
  const body = (await response.json()) as GeminiResponse
  const candidate = body.candidates?.[0]
  const text = (candidate?.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim()

  if (text === '') {
    throw new ProviderError(
      candidate?.finishReason === 'MAX_TOKENS'
        ? 'La IA se quedó sin espacio antes de responder. Prueba con una frase más corta.'
        : 'La IA no devolvió texto. Inténtalo de nuevo.',
      502,
    )
  }

  return text
}

/**
 * Convierte el texto en JSON. `responseMimeType` debería garantizarlo, pero si el
 * modelo se sale del guion preferimos un error claro a un `undefined` río abajo.
 */
function readJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    console.error('[gemini] respuesta no JSON:', text.slice(0, 200))
    throw new ProviderError('La IA devolvió algo que no se puede leer. Inténtalo de nuevo.', 502)
  }
}
