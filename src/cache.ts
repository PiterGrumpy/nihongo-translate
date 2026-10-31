import type { TranslationRequest, TranslationResult } from './types'

/**
 * Caché en memoria de resultados ya pedidos.
 *
 * Motivo: los tres modos son peticiones distintas de la misma frase. Sin caché, probar
 * Traductor → Desglose → Gramática y volver a Traductor son cuatro llamadas a la IA,
 * y la cuarta tarda lo mismo que la primera para devolver exactamente lo mismo.
 *
 * La clave incluye dirección, modo y frase: el mismo texto en `ja-to-es` y en `es-to-ja`
 * son peticiones diferentes y no deben compartir resultado.
 *
 * Vive solo en memoria (decisión de la V1: nada de `localStorage`): al recargar la
 * página se vacía. Tampoco hay que invalidarla a mano: cada respuesta es inmutable.
 */

/** Tope para que la pestaña no crezca sin control en una sesión larga. */
const MAX_ENTRIES = 100

const results = new Map<string, TranslationResult>()

function keyOf(request: TranslationRequest): string {
  return `${request.direction}|${request.mode}|${request.text}`
}

/** Resultado ya pedido para esta frase, o `null` si hay que llamar a la IA. */
export function cachedResult(request: TranslationRequest): TranslationResult | null {
  return results.get(keyOf(request)) ?? null
}

/** Guarda un resultado recién llegado. Si la caché está llena, tira el más antiguo. */
export function rememberResult(request: TranslationRequest, result: TranslationResult): void {
  if (results.size >= MAX_ENTRIES) {
    const oldest = results.keys().next().value
    if (oldest !== undefined) results.delete(oldest)
  }
  results.set(keyOf(request), result)
}
