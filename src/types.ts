// El "contrato" de la app: qué modos existen y qué forma tiene una respuesta.
// Lo usan tanto la interfaz como (a partir de la Etapa 2) la función del servidor.

/** Los tres modos = las tres pestañas. Cada uno pide un prompt distinto a la IA. */
export type Mode = 'translate' | 'breakdown' | 'grammar'

/** Dirección de la traducción. */
export type Direction = 'ja-to-es' | 'es-to-ja'

/**
 * Un trozo de la frase japonesa con su lectura en kana.
 * `reading` es lo que se pinta encima del kanji cuando el furigana está activo.
 * `meaning` solo llega en los modos breakdown y grammar.
 */
export type Segment = {
  text: string
  reading?: string
  meaning?: string
}

/** Lo que el navegador envía a /api/translate. */
export type TranslationRequest = {
  text: string
  mode: Mode
  direction: Direction
}

/** Lo que la función devuelve. `grammar` solo existe en el modo grammar. */
export type TranslationResult = {
  mode: Mode
  translation: string
  segments: Segment[]
  grammar?: string
}
