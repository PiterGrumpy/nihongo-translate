import { useEffect, useState, type FormEvent } from 'react'
import { requestTranslation } from './api'
import { cachedResult, rememberResult } from './cache'
import { ResultCard } from './components/ResultCard'
import { MODES, modeInfo } from './modes'
import type { Direction, Mode, TranslationRequest, TranslationResult } from './types'

/** Petición + respuesta, para que la tarjeta sepa de qué frase habla. */
type Answer = {
  request: TranslationRequest
  result: TranslationResult
}

const DIRECTIONS: Array<{ id: Direction; label: string }> = [
  { id: 'ja-to-es', label: '日本語 → Español' },
  { id: 'es-to-ja', label: 'Español → 日本語' },
]

export default function App() {
  const [mode, setMode] = useState<Mode>('translate')
  const [direction, setDirection] = useState<Direction>('ja-to-es')
  const [text, setText] = useState('')
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Segundos que lleva la petición en curso. Solo informa: no cambia nada de la petición. */
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!isLoading) {
      setElapsed(0)
      return
    }

    const startedAt = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [isLoading])

  const activeMode = modeInfo(mode)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const phrase = text.trim()
    if (!phrase || isLoading) return

    // El modo y la dirección se capturan aquí: la respuesta pertenece a esta petición,
    // aunque el usuario cambie de pestaña mientras espera.
    const request: TranslationRequest = { text: phrase, mode, direction }

    setError(null)

    // Ya pedida antes (misma frase, modo y dirección): se pinta sin llamar a la IA.
    const cached = cachedResult(request)
    if (cached) {
      setAnswer({ request, result: cached })
      return
    }

    setIsLoading(true)

    try {
      const result = await requestTranslation(request)
      rememberResult(request, result)
      setAnswer({ request, result })
    } catch (problem) {
      // La tarjeta anterior era de otra frase: dejarla visible junto al error confunde.
      setAnswer(null)
      setError(problem instanceof Error ? problem.message : 'Algo salió mal.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8 flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-red-600 text-2xl text-white shadow-sm">
            日
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Nihon Translator</h1>
            <p className="text-sm text-stone-500">Japonés ↔ español para estudiar, no solo para copiar.</p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
          {/* Pestañas = selector del modo. Cambian la petición, no el resultado ya mostrado. */}
          <div role="tablist" aria-label="Modo de análisis" className="flex gap-1 rounded-xl bg-stone-100 p-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={mode === m.id}
                onClick={() => setMode(m.id)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  mode === m.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-2 px-1 text-xs text-stone-500">{activeMode.hint}</p>

          {/* Dirección de la traducción. */}
          <div className="mt-5 flex flex-wrap gap-2">
            {DIRECTIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDirection(d.id)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  direction === d.id
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-600 hover:border-stone-400'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={direction === 'ja-to-es' ? '学校に行きます。' : 'Voy a la escuela.'}
            rows={4}
            className="mt-3 w-full resize-none rounded-xl border border-stone-200 bg-stone-50 p-4 text-lg leading-relaxed outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
          />

          <div className="mt-3 flex items-center justify-between gap-4">
            <span className="text-xs text-stone-400">{text.length} caracteres</span>
            <button
              type="submit"
              disabled={!text.trim() || isLoading}
              className="rounded-xl bg-red-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {isLoading ? `Traduciendo…${elapsed > 0 ? ` ${elapsed}s` : ''}` : 'Traducir'}
            </button>
          </div>

          {/* La IA gratuita tiene cola: si tarda, mejor decirlo que dejar el botón mudo. */}
          {isLoading && elapsed >= 10 && (
            <p className="mt-3 text-xs text-amber-700">
              El modelo gratuito está lento ahora mismo. Puedes esperar o volver a intentarlo.
            </p>
          )}
        </form>

        {/* Una sola salida: la del modo que se envió. Sin pestañas aquí. */}
        <section className="mt-6">
          {error && (
            <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </p>
          )}

          {answer ? (
            <ResultCard request={answer.request} result={answer.result} />
          ) : (
            <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
              La respuesta aparecerá aquí. Elige un modo, escribe una frase y pulsa Traducir.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
