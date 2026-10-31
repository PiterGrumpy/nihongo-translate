import { modeInfo } from '../modes'
import type { TranslationRequest, TranslationResult } from '../types'
import { Furigana } from './Furigana'

type Props = {
  /** La petición que generó esta respuesta: así el original no se confunde si luego editas. */
  request: TranslationRequest
  result: TranslationResult
}

/**
 * La única salida de la app.
 *
 * Cada modo enseña un nivel más de detalle:
 * - Traductor: original + traducción
 * - Desglose:  + palabra por palabra (lectura y significado)
 * - Gramática: + explicación
 *
 * El japonés se pinta con `<ruby>` cuando el interruptor global de furigana está activo:
 * el original en `ja-to-es` y la traducción en `es-to-ja` (son los trozos que devuelve la IA).
 */
export function ResultCard({ request, result }: Props) {
  const mode = modeInfo(result.mode)
  const showBreakdown = result.mode !== 'translate' && result.segments.length > 0

  // La IA trocea la frase japonesa: el original al traducir desde japonés y la
  // traducción al traducir desde español (ver `segmentsSource` en server/prompts.ts).
  const japanese = request.direction === 'ja-to-es' ? request.text : result.translation

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${mode.badge}`}>
          Resultado de: {mode.label}
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-medium tracking-wide text-stone-400 uppercase">Original</h3>
          <p className="mt-1 whitespace-pre-wrap text-stone-500">
            {request.direction === 'ja-to-es' ? (
              <Furigana segments={result.segments} fallback={request.text} />
            ) : (
              request.text
            )}
          </p>
        </div>
        <div>
          <h3 className="text-xs font-medium tracking-wide text-stone-400 uppercase">Traducción</h3>
          <p className="mt-1 text-lg leading-relaxed whitespace-pre-wrap text-stone-900">
            {request.direction === 'es-to-ja' ? (
              <Furigana segments={result.segments} fallback={japanese} />
            ) : (
              result.translation
            )}
          </p>
        </div>
      </div>

      {showBreakdown && (
        <div className="mt-5">
          <h3 className="text-xs font-medium tracking-wide text-stone-400 uppercase">Palabra por palabra</h3>
          <ul className="mt-2 divide-y divide-stone-100 border-t border-stone-100">
            {result.segments.map((segment, index) => (
              <li
                key={`${segment.text}-${index}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2"
              >
                <span className="text-lg leading-snug">{segment.text}</span>
                {segment.reading && <span className="text-xs text-sky-700">{segment.reading}</span>}
                {segment.meaning && <span className="text-sm text-stone-600">{segment.meaning}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.grammar && (
        <div className="mt-5 rounded-xl bg-violet-50 p-4">
          <h3 className="text-xs font-medium tracking-wide text-violet-800 uppercase">Gramática</h3>
          <p className="mt-1 text-sm leading-relaxed text-stone-700">{result.grammar}</p>
        </div>
      )}
    </article>
  )
}
