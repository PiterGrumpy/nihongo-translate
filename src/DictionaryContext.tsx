import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  addEntry,
  hasEntry,
  removeEntry,
  type DictionaryEntry,
} from './dictionary'

/**
 * Estado global del diccionario de sesión.
 *
 * Vive en un contexto propio (separado de `SettingsContext`) porque cambia con cada
 * palabra guardada: si compartiera contexto con el furigana, guardar una palabra
 * volvería a pintar también todos los ajustes y al revés.
 *
 * La lógica de añadir/quitar está en `dictionary.ts` (pura y probada). Aquí solo se
 * guarda la lista en el estado de React. No hay red, ni servidor, ni `localStorage`:
 * al recargar la página el diccionario vuelve a estar vacío.
 */
type Dictionary = {
  entries: DictionaryEntry[]
  /** Añade una palabra. Si ya estaba (mismo texto y lectura) no hace nada. */
  saveWord: (word: DictionaryEntry) => void
  /** Quita una palabra por su clave (`entryKey`). */
  removeWord: (key: string) => void
  /** ¿Está ya guardada? Lo usa el botón Guardar/Guardado de la tarjeta. */
  hasWord: (word: Pick<DictionaryEntry, 'text' | 'reading'>) => boolean
}

const DictionaryContext = createContext<Dictionary | null>(null)

export function DictionaryProvider({
  children,
  /** Solo para pruebas de render: permite arrancar con palabras ya guardadas. */
  initialEntries = [],
}: {
  children: ReactNode
  initialEntries?: DictionaryEntry[]
}) {
  const [entries, setEntries] = useState<DictionaryEntry[]>(initialEntries)

  const saveWord = useCallback((word: DictionaryEntry) => {
    setEntries((current) => addEntry(current, word))
  }, [])

  const removeWord = useCallback((key: string) => {
    setEntries((current) => removeEntry(current, key))
  }, [])

  const value = useMemo<Dictionary>(
    () => ({
      entries,
      saveWord,
      removeWord,
      hasWord: (word) => hasEntry(entries, word),
    }),
    [entries, saveWord, removeWord],
  )

  return <DictionaryContext.Provider value={value}>{children}</DictionaryContext.Provider>
}

/** Leer el diccionario desde cualquier componente. Falla claro si falta el provider. */
export function useDictionary(): Dictionary {
  const dictionary = useContext(DictionaryContext)
  if (!dictionary) throw new Error('useDictionary debe usarse dentro de <DictionaryProvider>.')
  return dictionary
}
