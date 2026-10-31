import { useState } from 'react'
import { useDictionary } from '../DictionaryContext'
import { entryKey } from '../dictionary'
import { useSettings } from '../SettingsContext'
import { Furigana } from './Furigana'

/**
 * Lista de palabras guardadas durante la sesión.
 *
 * Va **debajo** de la tarjeta de resultado, no es una pestaña: el diccionario no es
 * un modo de traducción y no debe competir con la regla de "una sola salida".
 *
 * Se oculta sola mientras está vacía: al principio no hay nada que enseñar y un panel
 * vacío solo añade ruido. En cuanto se guarda la primera palabra aparece desplegada.
 */
export function Dictionary() {
  const { entries, removeWord } = useDictionary()
  const { showFurigana } = useSettings()
  const [open, setOpen] = useState(true)

  if (entries.length === 0) return null

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="session-dictionary"
        className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-stone-300"
      >
        <span className="text-sm font-medium text-stone-800">Diccionario de sesión</span>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
          {entries.length}
        </span>
        <span className="ml-auto text-xs text-stone-400">{open ? 'Ocultar' : 'Mostrar'}</span>
      </button>

      {open && (
        <div id="session-dictionary" className="mt-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <ul className="divide-y divide-stone-100">
            {entries.map((entry) => (
              <li key={entryKey(entry)} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                <span className="text-lg leading-relaxed">
                  <Furigana
                    segments={[{ text: entry.text, reading: entry.reading }]}
                    fallback={entry.text}
                  />
                </span>

                {/* Con el furigana encendido la lectura ya va encima: no se repite. */}
                {!showFurigana && entry.reading && (
                  <span className="text-xs text-sky-700">{entry.reading}</span>
                )}

                <span className="text-sm text-stone-600">{entry.meaning}</span>

                <button
                  type="button"
                  onClick={() => removeWord(entryKey(entry))}
                  aria-label={`Quitar ${entry.text} del diccionario`}
                  className="ml-auto rounded-full border border-stone-200 px-2.5 py-0.5 text-xs text-stone-500 transition hover:border-red-300 hover:text-red-700"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>

          <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-400">
            Solo dura esta sesión: al recargar la página se vacía.
          </p>
        </div>
      )}
    </section>
  )
}
