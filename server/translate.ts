import type { Direction, Mode, Segment, TranslationRequest, TranslationResult } from '../src/types.ts'
import { FIXTURES } from './fixtures.ts'

/** Límite defensivo: suficiente para una frase de estudio y barato de validar. */
export const MAX_TEXT_LENGTH = 500

const MODES: readonly Mode[] = ['translate', 'breakdown', 'grammar']
const DIRECTIONS: readonly Direction[] = ['ja-to-es', 'es-to-ja']

/**
 * Error de petición mal formada. La capa HTTP lo traduce a un 400; el resto de errores
 * son fallos nuestros (500).
 */
export class InvalidRequestError extends Error {}

/**
 * Comprueba el cuerpo de la petición y devuelve una petición limpia.
 * No fiarse del cliente: el `mode` decide qué prompt se usa en la Etapa 3.
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
 * Devuelve una respuesta falsa con la forma exacta de `TranslationResult`.
 *
 * Es acumulativo, igual que el diseño:
 * - `translate`  → traducción + segmentos con lectura
 * - `breakdown`  → lo anterior + significado de cada palabra
 * - `grammar`    → lo anterior + explicación gramatical
 */
export function translate(request: TranslationRequest): TranslationResult {
  const fixture = FIXTURES[request.direction]

  const result: TranslationResult = {
    mode: request.mode,
    translation: fixture.translation,
    segments: segmentsForMode(fixture.segments, request.mode),
  }

  if (request.mode === 'grammar') {
    result.grammar = fixture.grammar
  }

  return result
}

/** Copia los segmentos quedándose solo con los campos que corresponden al modo. */
function segmentsForMode(segments: Segment[], mode: Mode): Segment[] {
  return segments.map((segment) => {
    const copy: Segment = { text: segment.text }

    // La lectura viaja siempre: el furigana puede activarse en cualquier modo.
    if (segment.reading) copy.reading = segment.reading

    // El significado solo tiene sentido a partir del desglose.
    if (mode !== 'translate' && segment.meaning) copy.meaning = segment.meaning

    return copy
  })
}
