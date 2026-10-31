import type { Mode, Segment, TranslationResult } from '../src/types.ts'
import { ProviderError } from './providers/index.ts'

/**
 * Frontera de seguridad del servidor: lo que devuelve la IA no se da por bueno.
 *
 * Aunque el prompt y el esquema JSON empujen a la forma correcta, aquí se comprueba
 * campo por campo. Un campo que falta, un tipo raro o una lista vacía se convierten en
 * un error con mensaje, nunca en un `undefined` que reviente la tarjeta.
 *
 * El recorte es acumulativo, igual que el diseño de los modos:
 * - `translate`  → traducción + segmentos con lectura
 * - `breakdown`  → lo anterior + significado de cada palabra
 * - `grammar`    → lo anterior + explicación gramatical
 */
export function sanitizeAnswer(answer: unknown, mode: Mode): TranslationResult {
  if (typeof answer !== 'object' || answer === null) throw incomplete('la respuesta')

  const { translation, segments, grammar } = answer as Partial<TranslationResult>

  if (typeof translation !== 'string' || translation.trim() === '') {
    throw incomplete('la traducción')
  }

  if (!Array.isArray(segments)) throw incomplete('el desglose')

  const clean = segments
    .map((segment) => toSegment(segment, mode))
    .filter((segment): segment is Segment => segment !== null)

  if (clean.length === 0) throw incomplete('el desglose')

  const result: TranslationResult = { mode, translation: translation.trim(), segments: clean }

  if (mode === 'grammar') {
    if (typeof grammar !== 'string' || grammar.trim() === '') {
      throw incomplete('la explicación gramatical')
    }
    result.grammar = grammar.trim()
  }

  return result
}

/**
 * Un segmento limpio, o `null` si no tiene texto.
 *
 * La lectura viaja siempre (el furigana puede activarse en cualquier modo); el
 * significado solo a partir del desglose.
 */
function toSegment(value: unknown, mode: Mode): Segment | null {
  if (typeof value !== 'object' || value === null) return null

  const { text, reading, meaning } = value as Partial<Segment>
  if (typeof text !== 'string' || text.trim() === '') return null

  const segment: Segment = { text: text.trim() }

  if (typeof reading === 'string' && reading.trim() !== '') segment.reading = reading.trim()
  if (mode !== 'translate' && typeof meaning === 'string' && meaning.trim() !== '') {
    segment.meaning = meaning.trim()
  }

  return segment
}

/** Respuesta incompleta: es culpa de la IA, no de quien llama. */
function incomplete(what: string): ProviderError {
  return new ProviderError(`La IA no devolvió ${what}. Inténtalo de nuevo.`, 502)
}
