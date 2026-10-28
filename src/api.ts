import type { TranslationRequest, TranslationResult } from './types'

/**
 * Única puerta al servidor. La interfaz no sabe si detrás hay Vite o Netlify:
 * solo conoce esta ruta y el contrato de `types.ts`.
 *
 * Lanza `Error` con un mensaje ya listo para enseñar al usuario; la interfaz
 * no tiene que interpretar códigos HTTP.
 */
export async function requestTranslation(request: TranslationRequest): Promise<TranslationResult> {
  let response: Response

  try {
    response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor. Comprueba que sigue arrancado.')
  }

  const data: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(errorMessage(data) ?? `El servidor respondió con un error ${response.status}.`)
  }

  // Frontera: lo que llega de fuera no se da por bueno sin mirarlo.
  if (!isTranslationResult(data)) {
    throw new Error('El servidor devolvió una respuesta con una forma inesperada.')
  }

  return data
}

/** Saca el mensaje de un body de error `{ error: string }`. */
function errorMessage(data: unknown): string | null {
  if (typeof data === 'object' && data !== null && 'error' in data) {
    const { error } = data as { error?: unknown }
    if (typeof error === 'string') return error
  }
  return null
}

/** Comprobación mínima de que el JSON tiene la forma de `TranslationResult`. */
function isTranslationResult(data: unknown): data is TranslationResult {
  if (typeof data !== 'object' || data === null) return false

  const candidate = data as Partial<TranslationResult>

  return (
    typeof candidate.mode === 'string' &&
    typeof candidate.translation === 'string' &&
    Array.isArray(candidate.segments) &&
    (candidate.grammar === undefined || typeof candidate.grammar === 'string')
  )
}
