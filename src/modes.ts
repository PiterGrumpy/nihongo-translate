import type { Mode } from './types'

/**
 * Metadatos de los tres modos en un solo sitio: pestaña, frase de ayuda y color
 * de la etiqueta. Lo usan la barra de pestañas (App) y la tarjeta de resultado.
 */
export const MODES: Array<{ id: Mode; label: string; hint: string; badge: string }> = [
  {
    id: 'translate',
    label: 'Traductor',
    hint: 'Traduce la frase, sin más.',
    badge: 'bg-sky-50 text-sky-800 ring-sky-200',
  },
  {
    id: 'breakdown',
    label: 'Desglose',
    hint: 'Traduce y explica la frase parte a parte.',
    badge: 'bg-amber-50 text-amber-900 ring-amber-200',
  },
  {
    id: 'grammar',
    label: 'Gramática',
    hint: 'Traduce, desglosa y explica la gramática. El modo más completo.',
    badge: 'bg-violet-50 text-violet-900 ring-violet-200',
  },
]

/** El `!` es seguro: `mode` siempre es uno de los tres valores del tipo. */
export function modeInfo(mode: Mode) {
  return MODES.find((item) => item.id === mode)!
}
