import { useState, type FormEvent } from 'react'
import { requestTranslation } from './api'
import type { Direction, Mode, TranslationResult } from './types'

// Las tres pestañas. `hint` es la frase que explica qué hace cada modo,
// para que el usuario no tenga que adivinar qué cambia al cambiar de pestaña.
const MODES: Array<{ id: Mode; label: string; hint: string }> = [
  { id: 'translate', label: 'Traductor', hint: 'Traduce la frase, sin más.' },
  { id: 'breakdown', label: 'Desglose', hint: 'Traduce y explica la frase parte a parte.' },
  { id: 'grammar', label: 'Gramática', hint: 'Traduce, desglosa y explica la gramática. El modo más completo.' },
]

const DIRECTIONS: Array<{ id: Direction; label: string }> = [
  { id: 'ja-to-es', label: '日本語 → Español' },
  { id: 'es-to-ja', label: 'Español → 日本語' },
]

// Color de la etiqueta de la tarjeta de resultado, según el modo que la generó.
const BADGE: Record<Mode, string> = {
  translate: 'bg-sky-50 text-sky-800 ring-sky-200',
  breakdown: 'bg-amber-50 text-amber-900 ring-amber-200',
  grammar: 'bg-violet-50 text-violet-900 ring-violet-200',
}

const labelOf = (mode: Mode) => MODES.find((m) => m.id === mode)!.label

export default function App() {
  const [mode, setMode] = useState<Mode>('translate')
  const [direction, setDirection] = useState<Direction>('ja-to-es')
  const [text, setText] = useState('')
  const [result, setResult] = useState<TranslationResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeMode = MODES.find((m) => m.id === mode)!

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const phrase = text.trim()
    if (!phrase || isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      // El modo y la dirección se capturan aquí: la respuesta pertenece a esta petición,
      // aunque el usuario cambie de pestaña mientras espera.
      const data = await requestTranslation({ text: phrase, mode, direction })
      setResult(data)
    } catch (problem) {
      // La tarjeta anterior era de otra frase: dejarla visible junto al error confunde.
      setResult(null)
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
              {isLoading ? 'Traduciendo…' : 'Traducir'}
            </button>
          </div>
        </form>

        {/* Una sola salida: la del modo que se envió. Sin pestañas aquí. */}
        <section className="mt-6">
          {error && (
            <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </p>
          )}

          {result ? (
            <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${BADGE[result.mode]}`}>
                  Resultado de: {labelOf(result.mode)}
                </span>
                <span className="text-xs text-stone-400">Datos de prueba · sin IA todavía</span>
              </div>
              <p className="whitespace-pre-wrap text-stone-800">{result.translation}</p>
            </article>
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
