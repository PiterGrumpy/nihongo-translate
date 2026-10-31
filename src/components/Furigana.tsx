import { useSettings } from '../SettingsContext'
import type { Segment } from '../types'

type Props = {
  /** Trozos japoneses que devolvió la IA, en el mismo orden de la frase. */
  segments: Segment[]
  /** El japonés completo, tal como debe verse si no hay furigana o si los trozos no cuadran. */
  fallback: string
}

/**
 * Pinta japonés con la lectura encima de cada trozo (furigana).
 *
 * Reglas:
 * - Interruptor apagado → texto plano, sin `<ruby>`.
 * - Trozo sin lectura, o cuya lectura es igual al texto (kana puro) → texto plano,
 *   para no repetir la misma sílaba dos veces.
 * - Si al unir los trozos no sale la frase de `fallback` (la IA troceó distinto o
 *   normalizó el texto), se pinta el texto plano: mejor sin furigana que con una
 *   frase rota o desordenada.
 */
export function Furigana({ segments, fallback }: Props) {
  const { showFurigana } = useSettings()

  if (!showFurigana || segments.length === 0) return <>{fallback}</>

  const joined = segments.map((segment) => segment.text).join('')
  if (compact(joined) !== compact(fallback)) return <>{fallback}</>

  return (
    <>
      {segments.map((segment, index) => (
        <SegmentText key={`${segment.text}-${index}`} segment={segment} />
      ))}
      {/* La IA a veces deja la puntuación final fuera de los trozos: no la perdemos. */}
      {fallback.startsWith(joined) ? fallback.slice(joined.length) : null}
    </>
  )
}

/** Un trozo: con `<ruby>` si tiene lectura distinta del propio texto. */
function SegmentText({ segment }: { segment: Segment }) {
  const reading = segment.reading?.trim()

  if (!reading || reading === segment.text) return <>{segment.text}</>

  return (
    <ruby>
      {segment.text}
      <rt className="text-[0.55em] text-sky-700">{reading}</rt>
    </ruby>
  )
}

/**
 * Compara sin espacios ni puntuación.
 *
 * Motivo: el japonés de la IA puede trocearse sin el punto final (`学校に行きます` frente
 * a `学校に行きます。`). Eso no es un fallo de la frase, solo del troceado.
 */
function compact(text: string): string {
  return text.replace(/[\s。、！？!?.,，・「」『』（）()]/g, '')
}
