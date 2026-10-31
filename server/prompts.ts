import type { Mode, TranslationRequest } from '../src/types.ts'

/**
 * Los prompts de los tres modos, en un solo sitio.
 *
 * Motivo de tenerlo aparte de `translate.ts`: el texto de instrucciones se retoca mucho
 * (y gasta cuota cada vez que se prueba), la lógica de saneado casi nada. Separados,
 * se puede iterar el prompt sin tocar el código que lo consume.
 *
 * El modo lo elige el servidor a partir del campo `mode` del cuerpo; el cliente nunca
 * manda instrucciones.
 */

/** Subconjunto del esquema OpenAPI que entiende Gemini para forzar la forma del JSON. */
export type JsonSchema = {
  type: 'object' | 'array' | 'string'
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  required?: string[]
  propertyOrdering?: string[]
}

/** Todo lo que el proveedor necesita para hacer una llamada. */
export type Prompt = {
  systemInstruction: string
  userText: string
  schema: JsonSchema
}

/**
 * Reglas comunes a los tres modos.
 *
 * Insistir en el JSON y en la lectura kana no es redundancia: el esquema obliga a la
 * forma, pero no al contenido. Si no se pide la lectura, la IA la deja vacía y el
 * furigana (Etapa 4) se queda sin datos.
 */
const COMMON_RULES = `Eres un profesor de japonés que ayuda a estudiantes hispanohablantes.
Responde siempre en español, excepto el texto japonés.
Devuelve únicamente el JSON pedido: sin markdown, sin texto antes ni después.`

const SEGMENTS_RULE = `El campo "segments" trocea la frase japonesa en palabras y partículas, en el mismo orden en que aparecen.
Cada trozo lleva "text" (tal cual aparece en la frase japonesa) y "reading" (su lectura en hiragana).
Los trozos que ya son kana llevan en "reading" el mismo texto.`

const MEANING_RULE = `Cada trozo lleva además "meaning": su significado en español, muy breve (1 a 3 palabras).`

const GRAMMAR_RULE = `Añade "grammar": una explicación de la estructura de la frase en español, de 2 a 3 frases.
Menciona el orden de las palabras y el papel de cada partícula. No repitas la traducción.`

/** Instrucción según el modo. Acumulativas: gramática ⊃ desglose ⊃ traducción. */
function modeInstruction(mode: Mode): string {
  switch (mode) {
    case 'translate':
      return `Traduce la frase. No expliques nada más.`
    case 'breakdown':
      return `Traduce la frase y explica qué aporta cada trozo. ${MEANING_RULE}`
    case 'grammar':
      return `Traduce la frase y explica qué aporta cada trozo. ${MEANING_RULE} ${GRAMMAR_RULE}`
  }
}

/** De qué frase salen los segmentos: del original o de la traducción que produce la IA. */
function segmentsSource(request: TranslationRequest): string {
  return request.direction === 'ja-to-es'
    ? 'Trocea la frase japonesa original.'
    : 'Trocea la traducción japonesa que acabas de escribir.'
}

function directionInstruction(request: TranslationRequest): string {
  return request.direction === 'ja-to-es'
    ? 'La frase de entrada está en japonés: tradúcela al español natural.'
    : 'La frase de entrada está en español: tradúcela al japonés con formas educadas (です/ます) salvo que el texto pida otro registro.'
}

/**
 * Esquema de la respuesta. Se genera por modo para no pedir campos que luego se
 * recortan: en `translate` el significado de cada palabra no se muestra, así que
 * pedirlo sería gastar cupo para tirarlo.
 */
function schemaFor(mode: Mode): JsonSchema {
  const segmentProperties: Record<string, JsonSchema> = {
    text: { type: 'string' },
    reading: { type: 'string' },
  }
  const segmentOrder = ['text', 'reading']

  if (mode !== 'translate') {
    segmentProperties.meaning = { type: 'string' }
    segmentOrder.push('meaning')
  }

  const properties: Record<string, JsonSchema> = {
    translation: { type: 'string' },
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: segmentProperties,
        required: ['text'],
        propertyOrdering: segmentOrder,
      },
    },
  }
  const order = ['translation', 'segments']

  if (mode === 'grammar') {
    properties.grammar = { type: 'string' }
    order.push('grammar')
  }

  return {
    type: 'object',
    properties,
    required: mode === 'grammar' ? ['translation', 'segments', 'grammar'] : ['translation', 'segments'],
    propertyOrdering: order,
  }
}

/** Construye el prompt del modo y la dirección pedidos. */
export function buildPrompt(request: TranslationRequest): Prompt {
  return {
    systemInstruction: [
      COMMON_RULES,
      modeInstruction(request.mode),
      directionInstruction(request),
      SEGMENTS_RULE,
      segmentsSource(request),
    ].join('\n\n'),
    userText: request.text,
    schema: schemaFor(request.mode),
  }
}
