import type { Direction, Mode, TranslationRequest, TranslationResult } from '../src/types.ts'
import { buildPrompt } from './prompts.ts'
import { askProvider, type ProviderEnv } from './providers/index.ts'
import { sanitizeAnswer } from './sanitize.ts'

/** Límite defensivo: suficiente para una frase de estudio y barato de validar. */
export const MAX_TEXT_LENGTH = 500

const MODES: readonly Mode[] = ['translate', 'breakdown', 'grammar']
const DIRECTIONS: readonly Direction[] = ['ja-to-es', 'es-to-ja']

/**
 * Error de petición mal formada. La capa HTTP lo traduce a un 400; el resto de errores
 * son fallos nuestros (500) o de la IA (`ProviderError`).
 */
export class InvalidRequestError extends Error {}

/**
 * Comprueba el cuerpo de la petición y devuelve una petición limpia.
 * No fiarse del cliente: el `mode` decide qué prompt se usa.
 */
export function parseTranslationRequest(body: unknown): TranslationRequest {
  if (typeof body !== 'object' || body === null) {
    throw new InvalidRequestError('El cuerpo debe ser un objeto JSON.')
  }

  const { text, mode, direction } = body as Partial<TranslationRequest>

  if (typeof text !== 'string' || text.trim() === '') {
    throw new InvalidRequestError('El texto no puede estar vacío.')
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new InvalidRequestError(`El texto no puede superar los ${MAX_TEXT_LENGTH} caracteres.`)
  }
  if (!MODES.includes(mode as Mode)) {
    throw new InvalidRequestError('Modo desconocido.')
  }
  if (!DIRECTIONS.includes(direction as Direction)) {
    throw new InvalidRequestError('Dirección desconocida.')
  }

  return { text: text.trim(), mode: mode as Mode, direction: direction as Direction }
}

/**
 * Traduce de verdad: elige el prompt del modo, llama al proveedor y sanea la respuesta.
 *
 * Sigue siendo la única puerta del resto del servidor: la capa HTTP y (en la Etapa 5)
 * la Netlify Function solo conocen esta función. Cambia por dentro, no por fuera.
 */
export async function translate(
  request: TranslationRequest,
  env: ProviderEnv,
): Promise<TranslationResult> {
  const answer = await askProvider(buildPrompt(request), env)
  return sanitizeAnswer(answer, request.mode)
}
